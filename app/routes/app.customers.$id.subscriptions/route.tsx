import type {LoaderFunctionArgs} from '@remix-run/node';
import {Link as RouterLink, useLoaderData} from '@remix-run/react';
import {
  Box,
  Page,
  Text,
  IndexFilters,
  BlockStack,
  InlineStack,
  Grid,
  Icon,
  Divider,
  Thumbnail,
  Link as PolarisLink,
} from '@shopify/polaris';
import {DeliveryIcon, DiscountIcon, ImageIcon, ClockIcon} from '@shopify/polaris-icons';
import {useTranslation} from 'react-i18next';
import {composeGid, parseGid} from '@shopify/admin-graphql-api-utilities';

import {getContracts} from '~/models/SubscriptionContract/SubscriptionContract.server';
import {authenticate} from '~/shopify.server';
import type {SubscriptionContractListItem} from '~/types/contracts';
import {SubscriptionContractStatus} from '~/types/contracts';
import {useContractListState} from '~/routes/app._index/hooks/useContractListState';
import {useDeliveryFrequencyFormatter} from '~/hooks';
import {useFormatDateTime} from '~/utils/helpers/date';
import {discountTextFromCycleDiscount} from '~/utils/helpers/contracts';
import {formatPrice} from '~/utils/helpers/money';

type LoaderData = {
  customerId: string;
  customerName: string;
  totalCount: number;
  contractsSample: SubscriptionContractListItem[];
};

export async function loader({request, params}: LoaderFunctionArgs) {
  const {admin} = await authenticate.admin(request);

  const numericId = params.id;
  if (!numericId) {
    throw new Response('缺少客户ID参数', {status: 400});
  }

  const customerGid = composeGid('Customer', Number(numericId));
  const query = `customer_id:"${customerGid}"`;
  const url = new URL(request.url);
  const savedView = (url.searchParams.get('savedView') || 'all').toLowerCase();

  const matchStatus = (status: string) => {
    switch (savedView) {
      case 'active':
        // 与全局合同列表一致，ACTIVE 视图同时包含 FAILED
        return (
          status === SubscriptionContractStatus.Active ||
          status === SubscriptionContractStatus.Failed
        );
      case 'paused':
        return status === SubscriptionContractStatus.Paused;
      case 'cancelled':
        return status === SubscriptionContractStatus.Cancelled;
      default:
        return true;
    }
  };

  // 累计统计该客户的订阅数量，分页遍历
  let totalCount = 0;
  let after: string | null | undefined = undefined;
  let contractsSample: SubscriptionContractListItem[] = [];

  // 最多遍历 5 页以避免无限循环（每页默认 first: 50，可根据需要调整）
  for (let i = 0; i < 5; i++) {
    const {subscriptionContracts, subscriptionContractPageInfo} =
      await getContracts(admin.graphql, {
        first: 50,
        after: after ?? undefined,
        query,
      });
    // 本地再按 customer.id 与状态精确过滤，确保与客户及所选视图一一对应
    const filtered = subscriptionContracts.filter(
      (c) => c.customer.id === customerGid && matchStatus(c.status),
    );
    totalCount += filtered.length;
    if (contractsSample.length === 0) {
      contractsSample = filtered;
    }

    if (!subscriptionContractPageInfo.hasNextPage) {
      break;
    }
    after = subscriptionContractPageInfo.endCursor ?? undefined;
  }

  // 从样本合同中提取客户名称；若无样本，则单独查询客户名称
  let customerName: string | undefined = contractsSample[0]?.customer?.displayName || undefined;
  if (!customerName) {
    try {
      const resp = await admin.graphql(
        `#graphql
        query CustomerName($id: ID!) { customer(id: $id) { displayName } }
        `,
        {variables: {id: customerGid}},
      );
      const json = await resp.json();
      customerName = json?.data?.customer?.displayName || undefined;
    } catch {}
  }

  const data: LoaderData = {
    customerId: numericId,
    customerName: customerName ?? numericId,
    totalCount,
    contractsSample,
  };
  return data;
}

export default function CustomerSubscriptionsCountPage() {
  const {customerName, contractsSample} =
    useLoaderData<LoaderData>();
  const {t} = useTranslation('app.customers.subscriptions');
  const {t: tContracts, i18n} = useTranslation('app.contracts');
  const locale = i18n.language;
  const formatDateTime = useFormatDateTime();
  const {deliveryFrequencyText} = useDeliveryFrequencyFormatter();
  const {
    filtersMode,
    setFiltersMode,
    selectedTab,
    handleTabSelect,
    tabs,
    listLoading,
  } = useContractListState(false);

  return (
    <Page
      backAction={{url: '/app/customers'}}
      title={t('page.title', {name: customerName})}
    >
      <Box>
        <IndexFilters
          loading={listLoading}
          tabs={tabs}
          selected={selectedTab}
          onSelect={(selectedTabIndex) => handleTabSelect(selectedTabIndex)}
          mode={filtersMode}
          setMode={setFiltersMode}
          onQueryChange={() => {}}
          onQueryClear={() => {}}
          cancelAction={{onAction: () => {}, disabled: false, loading: false}}
          canCreateNewView={false}
          filters={[]}
          onClearAll={() => {}}
          hideFilters
          hideQueryField
        />

        <Box paddingBlockStart="600" paddingBlockEnd="600" padding="400" borderEndStartRadius="300" borderEndEndRadius="300" background="bg-surface">
          {contractsSample.length === 0 ? (
            <Text as="p" variant="bodyMd" tone="subdued">
              {t('empty.sample')}
            </Text>
          ) : (
            <BlockStack gap="400">
              {[...contractsSample]
                .sort((a, b) => {
                  const aTs = (a.originOrderCreatedAt ?? a.nextBillingDate)
                    ? new Date(a.originOrderCreatedAt ?? a.nextBillingDate!).getTime()
                    : -Infinity;
                  const bTs = (b.originOrderCreatedAt ?? b.nextBillingDate)
                    ? new Date(b.originOrderCreatedAt ?? b.nextBillingDate!).getTime()
                    : -Infinity;
                  return bTs - aTs; // 从新到旧（降序）
                })
                .map((c) => {
                const firstLine = c.lines?.[0];
                const perItemPrice = firstLine?.currentPrice
                  ? formatPrice({
                      amount: Number(firstLine.currentPrice.amount),
                      currency: String(firstLine.currentPrice.currencyCode),
                      locale,
                    })
                  : undefined;
                const totalPrice = firstLine?.lineDiscountedPrice
                  ? formatPrice({
                      amount: Number(firstLine.lineDiscountedPrice.amount),
                      currency: String(
                        firstLine.lineDiscountedPrice.currencyCode,
                      ),
                      locale,
                    })
                  : undefined;
                const oneTimePurchasePrice =
                  firstLine?.pricingPolicy?.basePrice;
                const oneTimePurchaseText = oneTimePurchasePrice
                  ? tContracts('edit.details.oneTimePurchasePrice', {
                      price: formatPrice({
                        amount: Number(oneTimePurchasePrice.amount),
                        currency: String(oneTimePurchasePrice.currencyCode),
                        locale,
                      }),
                    })
                  : undefined;

                let discountText = '';
                const firstLineDiscount =
                  firstLine?.pricingPolicy?.cycleDiscounts?.[0];
                if ((c.lines?.length ?? 0) > 1) {
                  discountText = tContracts(
                    'details.discountValue.multipleDiscounts',
                  );
                } else if (firstLineDiscount) {
                  discountText = discountTextFromCycleDiscount(
                    firstLineDiscount as any,
                    tContracts,
                    locale,
                  );
                }

                const deliveryFrequency = deliveryFrequencyText(
                  c.deliveryPolicy,
                );

                return (
                  <Box padding="400" background="bg-surface" borderRadius="200" borderColor="border" borderWidth="025" key={c.id}>
                    <BlockStack gap="400">
                      <InlineStack align="space-between" wrap={false} gap="300">
                        <InlineStack gap="300" wrap={false}>
                          <Thumbnail
                            source={firstLine?.variantImageURL ?? ImageIcon}
                            alt={
                              firstLine?.variantTitle ?? firstLine?.title ?? ''
                            }
                            size="small"
                          />
                          <BlockStack gap="050">
                            <Text as="p" variant="bodySm" tone="subdued">
                              Contract ID:{' '}
                              <PolarisLink removeUnderline url={`/app/contracts/${parseGid(c.id)}`}>
                                {parseGid(c.id)}
                              </PolarisLink>
                            </Text>
                            <PolarisLink
                              removeUnderline
                              target="_top"
                              url={
                                firstLine?.productId
                                  ? `shopify://admin/products/${parseGid(firstLine.productId)}`
                                  : `/app/contracts/${parseGid(c.id)}`
                              }
                            >
                              <Text as="p" variant="bodyMd" fontWeight="medium">
                                {firstLine?.title || parseGid(c.id)}
                              </Text>
                            </PolarisLink>
                            {oneTimePurchaseText ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {oneTimePurchaseText}
                              </Text>
                            ) : null}
                          </BlockStack>
                        </InlineStack>
                        <InlineStack gap="300" wrap={false} blockAlign="center">
                          {perItemPrice ? (
                            <Text as="span" variant="bodyMd">
                              {perItemPrice}
                            </Text>
                          ) : null}
                          {firstLine?.quantity ? (
                            <Text
                              as="span"
                              variant="bodyMd"
                            >{`× ${firstLine.quantity}`}</Text>
                          ) : null}
                          {totalPrice ? (
                            <Text as="span" variant="bodyMd">
                              {totalPrice}
                            </Text>
                          ) : null}
                        </InlineStack>
                      </InlineStack>

                      <Divider />

              <BlockStack gap="200">
                {/* 订阅事件 */}
                <Grid columns={{xs: 3, sm: 3, md: 4, lg: 6, xl: 6}}>
                  <Grid.Cell
                    columnSpan={{xs: 1, sm: 1, md: 1, lg: 2, xl: 2}}
                  >
                    <InlineStack gap="100" align="start" wrap={false}>
                      <div>
                        <Icon source={ClockIcon} tone="base" />
                      </div>
                      <Text
                        variant="bodyLg"
                        tone="subdued"
                        as="span"
                        breakWord
                      >
                        {tContracts('details.subscriptionEvent')}
                      </Text>
                    </InlineStack>
                  </Grid.Cell>
                  <Grid.Cell
                    columnSpan={{xs: 2, sm: 2, md: 3, lg: 4, xl: 4}}
                  >
                    <InlineStack gap="200" wrap={false}>
                      {(() => {
                        const eventDate = c.originOrderCreatedAt ?? c.nextBillingDate;
                        return (
                          <Text as="span">
                            {eventDate ? formatDateTime(eventDate, locale) : '—'}
                          </Text>
                        );
                      })()}
                    </InlineStack>
                  </Grid.Cell>
                </Grid>

                {discountText ? (
                  <Grid columns={{xs: 3, sm: 3, md: 4, lg: 6, xl: 6}}>
                    <Grid.Cell
                      columnSpan={{xs: 1, sm: 1, md: 1, lg: 2, xl: 2}}
                    >
                              <InlineStack gap="100" align="start" wrap={false}>
                                <div>
                                  <Icon source={DiscountIcon} tone="base" />
                                </div>
                                <Text
                                  variant="bodyLg"
                                  tone="subdued"
                                  as="span"
                                  breakWord
                                >
                                  {tContracts('details.discount')}
                                </Text>
                              </InlineStack>
                            </Grid.Cell>
                            <Grid.Cell
                              columnSpan={{xs: 2, sm: 2, md: 3, lg: 4, xl: 4}}
                            >
                              <Text as="span">{discountText}</Text>
                            </Grid.Cell>
                          </Grid>
                        ) : null}
                        <Grid columns={{xs: 3, sm: 3, md: 4, lg: 6, xl: 6}}>
                          <Grid.Cell
                            columnSpan={{xs: 1, sm: 1, md: 1, lg: 2, xl: 2}}
                          >
                            <InlineStack gap="100" align="start" wrap={false}>
                              <div>
                                <Icon source={DeliveryIcon} tone="base" />
                              </div>
                              <Text
                                variant="bodyLg"
                                tone="subdued"
                                as="span"
                                breakWord
                              >
                                {tContracts('details.delivery')}
                              </Text>
                            </InlineStack>
                          </Grid.Cell>
                          <Grid.Cell
                            columnSpan={{xs: 2, sm: 2, md: 3, lg: 4, xl: 4}}
                          >
                            <Text as="span">{deliveryFrequency}</Text>
                          </Grid.Cell>
                        </Grid>
                      </BlockStack>
                    </BlockStack>
                  </Box>
                );
              })}
            </BlockStack>
          )}
        </Box>
      </Box>
    </Page>
  );
}

import type {LoaderFunctionArgs} from '@remix-run/node';
import {Link, useLoaderData} from '@remix-run/react';
import {Box, Card, Page, Text, IndexFilters} from '@shopify/polaris';
import {useTranslation} from 'react-i18next';
import {composeGid, parseGid} from '@shopify/admin-graphql-api-utilities';

import {getContracts} from '~/models/SubscriptionContract/SubscriptionContract.server';
import {authenticate} from '~/shopify.server';
import type {SubscriptionContractListItem} from '~/types/contracts';
import {SubscriptionContractStatus} from '~/types/contracts';
import {useContractListState} from '~/routes/app._index/hooks/useContractListState';

type LoaderData = {
  customerId: string;
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
    const {subscriptionContracts, subscriptionContractPageInfo} = await getContracts(
      admin.graphql,
      {
        first: 50,
        after: after ?? undefined,
        query,
      },
    );
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

  const data: LoaderData = {
    customerId: numericId,
    totalCount,
    contractsSample,
  };
  return data;
}

export default function CustomerSubscriptionsCountPage() {
  const {customerId, totalCount, contractsSample} = useLoaderData<LoaderData>();
  const {t} = useTranslation('app.customers.subscriptions');
  const {
    filtersMode,
    setFiltersMode,
    selectedTab,
    handleTabSelect,
    tabs,
    listLoading,
    sortOptions,
    onSort,
    sortSelected,
  } = useContractListState(false);

  return (
    <Page backAction={{url: '/app/customers'}} title={t('page.title', {id: customerId})}>
      <Box paddingBlockEnd="400" width="100%">
        <Card>
          <IndexFilters
            loading={listLoading}
            tabs={tabs}
            selected={selectedTab}
            onSelect={(selectedTabIndex) => handleTabSelect(selectedTabIndex)}
            mode={filtersMode}
            setMode={setFiltersMode}
            sortOptions={sortOptions}
            onSort={onSort}
            sortSelected={sortSelected}
            onQueryChange={() => {}}
            onQueryClear={() => {}}
            cancelAction={{onAction: () => {}, disabled: false, loading: false}}
            canCreateNewView={false}
            filters={[]}
            onClearAll={() => {}}
            hideFilters
            hideQueryField
          />
        </Card>
        <Card>
          <Box padding="400">
            <Text as="h2" variant="headingLg">
              {t('summary', {count: totalCount})}
            </Text>
            {contractsSample.length > 0 && (
              <Box paddingBlockStart="300">
                <Text as="p" variant="bodyMd">
                  {t('sample.title', {count: contractsSample.length})}
                </Text>
                <Box paddingBlockStart="200">
                  {contractsSample.map((c) => (
                    <Text key={c.id} as="p" variant="bodySm">
                      {t('sample.item.prefix')}
                      <Link to={`/app/contracts/${parseGid(c.id)}`}>
                        {c.id}
                      </Link>
                      {` ${t('sample.item.status', {status: c.status})}`}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Box>
    </Page>
  );
}
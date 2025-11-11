import {Link, useSearchParams, useNavigate} from '@remix-run/react';
import {useTranslation} from 'react-i18next';
import {
  Box,
  Card,
  IndexFilters,
  IndexTable,
  Text,
  useSetIndexFiltersMode,
  EmptySearchResult,
} from '@shopify/polaris';

type CustomerItem = {
  id: string;
  numericId: number;
  displayName: string | null;
  email: string | null;
  subscriptionCount: number;
};

type PageInfo = {hasNextPage: boolean; endCursor: string | null};

interface CustomersTableProps {
  customers: CustomerItem[];
  pageInfo: PageInfo;
}

export default function CustomersTable({customers, pageInfo}: CustomersTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const {mode, setMode} = useSetIndexFiltersMode();
  const navigate = useNavigate();
  const {t} = useTranslation('app.customers');

  const tabs = [
    {content: t('table.tabs.all'), id: 'all', accessibilityLabel: t('table.tabs.all')},
    {content: t('table.tabs.with'), id: 'with', accessibilityLabel: t('table.tabs.with')},
    {content: t('table.tabs.without'), id: 'without', accessibilityLabel: t('table.tabs.without')},
  ];
  const selectedTabKey = (searchParams.get('subsView') || 'all').toLowerCase();
  const selectedTab = Math.max(0, tabs.findIndex((t) => t.id === selectedTabKey));

  // 排序：按订阅数量 asc/desc，通过 URL 参数 subsSort 记录
  const sortSelected = [
    (searchParams.get('subsSort') || 'subs desc').toLowerCase(),
  ];
  const sortOptions = [
    {
      label: t('table.sort.subscriptionCountLabel'),
      value: 'subs asc',
      directionLabel: t('table.sort.ascendingLabel'),
    },
    {
      label: t('table.sort.subscriptionCountLabel'),
      value: 'subs desc',
      directionLabel: t('table.sort.descendingLabel'),
    },
  ];
  const onSort = (value: string[]) => {
    setSearchParams((params) => {
      params.delete('after');
      params.set('subsSort', value[0]);
      return params;
    });
  };

  const handleTabSelect = (tabIndex: number) => {
    setSearchParams((params) => {
      params.delete('after');
      const key = tabs[tabIndex]?.id ?? 'all';
      if (key === 'all') params.delete('subsView');
      else params.set('subsView', key);
      return params;
    });
  };

  const emptyStateMarkup = (
    <EmptySearchResult
      title={t('table.emptyState.title')}
      description={
        selectedTabKey === 'all'
          ? t('table.emptyState.allDescription')
          : selectedTabKey === 'with'
          ? t('table.emptyState.withDescription')
          : t('table.emptyState.withoutDescription')
      }
      withIllustration
    />
  );

  return (
    <Card padding="0">
      <IndexFilters
        tabs={tabs}
        selected={selectedTab}
        onSelect={(index) => handleTabSelect(index)}
        mode={mode}
        setMode={setMode}
        sortOptions={sortOptions as any}
        onSort={onSort}
        sortSelected={sortSelected}
        onQueryChange={() => {}}
        onQueryClear={() => {}}
        cancelAction={{
          onAction: () => {},
          disabled: false,
          loading: false,
        }}
        canCreateNewView={false}
        filters={[]}
        onClearAll={() => {}}
        hideFilters
        hideQueryField
      />
      <IndexTable
        resourceName={{
          singular: t('table.resourceName.singular'),
          plural: t('table.resourceName.plural'),
        }}
        itemCount={customers.length}
        headings={[
          {title: t('table.headings.id')},
          {title: t('table.headings.name')},
          {title: t('table.headings.email')},
          {title: t('table.headings.subscriptionCount')},
        ]}
        selectable={false}
        emptyState={emptyStateMarkup}
      >
        {[...customers]
          .sort((a, b) =>
            sortSelected[0].includes('asc')
              ? a.subscriptionCount - b.subscriptionCount
              : b.subscriptionCount - a.subscriptionCount,
          )
          .map((c, index) => (
          <IndexTable.Row
            id={String(c.numericId)}
            key={c.id}
            position={index}
            onClick={() => navigate(`/app/customers/${c.numericId}/subscriptions`)}
          >
            <IndexTable.Cell>
              <Text as="span" variant="bodySm">{c.numericId}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" variant="bodySm">{c.displayName ?? '-'}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" variant="bodySm">{c.email ?? '-'}</Text>
            </IndexTable.Cell>
            <IndexTable.Cell>
              <Text as="span" variant="bodySm">{c.subscriptionCount}</Text>
            </IndexTable.Cell>
          </IndexTable.Row>
        ))}
      </IndexTable>
      {pageInfo.hasNextPage && (
        <Box>
          <Link to={`?after=${encodeURIComponent(pageInfo.endCursor ?? '')}${selectedTabKey !== 'all' ? `&subsView=${selectedTabKey}` : ''}`}>{t('table.pagination.nextPage')}</Link>
        </Box>
      )}
    </Card>
  );
}
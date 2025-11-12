import type {LoaderFunctionArgs} from '@remix-run/node';
import {useLoaderData} from '@remix-run/react';
import {Page} from '@shopify/polaris';
import {composeGid, parseGid} from '@shopify/admin-graphql-api-utilities';

import {authenticate} from '~/shopify.server';
import {getContracts} from '~/models/SubscriptionContract/SubscriptionContract.server';
import CustomersTable from './components/CustomersTable/CustomersTable';

type CustomerItem = {
  id: string;
  numericId: number;
  displayName: string | null;
  email: string | null;
  subscriptionCount: number;
  lastOrderDate: string | null;
};

type LoaderData = {
  customers: CustomerItem[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

export async function loader({request}: LoaderFunctionArgs) {
  const {admin} = await authenticate.admin(request);

  // 拉取一页客户列表（示例：前 10 个客户）
  const customersQuery = `#graphql
    query Customers($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        edges {
          node {
            id
            displayName
            email
          }
        }
        pageInfo { hasNextPage, endCursor }
      }
    }
  `;
  const url = new URL(request.url);
  const afterParam = url.searchParams.get('after') || undefined;
  const subsView = (url.searchParams.get('subsView') || 'all').toLowerCase();
  const customersResp = await admin.graphql(customersQuery, {
    variables: {first: 10, after: afterParam},
  });
  const json = await customersResp.json();
  const edges = (json.data?.customers?.edges ?? []) as Array<{
    node: { id: string; displayName: string | null; email: string | null };
  }>;
  const pageInfo = json.data?.customers?.pageInfo ?? {hasNextPage: false, endCursor: null};

  const customers: CustomerItem[] = [];
  for (const edge of edges) {
    const gid = edge.node.id;
        const numericId = Number(parseGid(gid));
    // 最近订阅事件时间：遍历订阅合约，取 (originOrderCreatedAt 或 nextBillingDate) 的最大值
    let latestEventTs = 0;
    let latestEventIso: string | null = null;

    // 统计该客户的订阅数量（最多遍历 5 页以控制开销）
    const customerGid = composeGid('Customer', numericId);
    const query = `customer_id:"${customerGid}"`;
    let totalCount = 0;
    let after: string | undefined = undefined;

    for (let i = 0; i < 5; i++) {
      const {subscriptionContracts, subscriptionContractPageInfo} = await getContracts(
        admin.graphql,
        {
          first: 50,
          after,
          query,
        },
      );
      // 本地再按 customer.id 精确过滤，确保与客户一一对应
      const filtered = subscriptionContracts.filter(
        (c) => c.customer.id === customerGid,
      );
      totalCount += filtered.length;
      // 与详情页一致：事件时间 = originOrderCreatedAt 优先，否则 nextBillingDate
      for (const c of filtered) {
        const useDate = c.originOrderCreatedAt ?? c.nextBillingDate ?? null;
        if (useDate) {
          const ts = new Date(useDate).getTime();
          if (!Number.isNaN(ts) && ts > latestEventTs) {
            latestEventTs = ts;
            latestEventIso = useDate;
          }
        }
      }
      if (!subscriptionContractPageInfo.hasNextPage) break;
      after = subscriptionContractPageInfo.endCursor ?? undefined;
    }

    // 传递原始 ISO 字符串，由前端用店铺时区格式化
    const lastOrderDate = latestEventTs > 0 ? latestEventIso : null;

    customers.push({
        id: gid,
        numericId,
        displayName: edge.node.displayName ?? null,
        email: edge.node.email ?? null,
        subscriptionCount: totalCount,
        lastOrderDate,
      });
  }

  // 根据 subsView 进行筛选：with=有订阅，without=无订阅，all=全部
  const filteredCustomers = customers.filter((c) => {
    if (subsView === 'with') return c.subscriptionCount > 0;
    if (subsView === 'without') return c.subscriptionCount === 0;
    return true;
  });

  const data: LoaderData = {customers: filteredCustomers, pageInfo};
  return data;
}

export default function CustomersSubscriptionsListPage() {
  const {customers, pageInfo} = useLoaderData<LoaderData>();

  return (
    <Page title="Subscription Customers">
      <CustomersTable customers={customers} pageInfo={pageInfo} />
    </Page>
  );
}
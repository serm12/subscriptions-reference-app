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
        edges { node { id displayName email } }
        pageInfo { hasNextPage endCursor }
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
  const edges: Array<{node: {id: string; displayName: string | null; email: string | null}}> =
    json.data?.customers?.edges ?? [];
  const pageInfo = json.data?.customers?.pageInfo ?? {hasNextPage: false, endCursor: null};

  const customers: CustomerItem[] = [];
  for (const edge of edges) {
    const gid = edge.node.id;
    const numericId = Number(parseGid(gid));

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
      if (!subscriptionContractPageInfo.hasNextPage) break;
      after = subscriptionContractPageInfo.endCursor ?? undefined;
    }

    customers.push({
      id: gid,
      numericId,
      displayName: edge.node.displayName ?? null,
      email: edge.node.email ?? null,
      subscriptionCount: totalCount,
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
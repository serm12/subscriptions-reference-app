import {json} from '@remix-run/node';
import {useLoaderData, useNavigate} from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  IndexTable,
  EmptySearchResult,
  InlineStack,
  Button,
  Badge,
} from '@shopify/polaris';
import {ArrowRightIcon} from '@shopify/polaris-icons';
import {authenticate} from '~/shopify.server';
import {getContracts} from '~/models/SubscriptionContract/SubscriptionContract.server';
import {useFormatDateTime} from '~/utils/helpers/date';
import {useTranslation} from 'react-i18next';

export async function loader({request}: {request: Request}) {
  const {admin} = await authenticate.admin(request);

  // Fetch Recent Contracts
  const {subscriptionContracts} = await getContracts(admin.graphql, {
    first: 5,
    sortKey: 'CREATED_AT',
    reverse: true,
  });

  // Fetch Recent Customers
  const customersQuery = `#graphql
    query Customers($first: Int!) {
      customers(first: $first, reverse: true) {
        edges {
          node {
            id
            displayName
            email
          }
        }
      }
    }
  `;
  const customersResp = await admin.graphql(customersQuery, {
    variables: {first: 5},
  });
  const customersJson = await customersResp.json();
  const customers = customersJson.data?.customers?.edges?.map((edge: any) => edge.node) || [];

  return json({
    recentContracts: subscriptionContracts,
    recentCustomers: customers,
  });
}

export default function Dashboard() {
  const {recentContracts, recentCustomers} = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const {t, i18n} = useTranslation();
  const formatDateTime = useFormatDateTime();

  const handleContractClick = (id: string) => {
    // Extract numeric ID if needed, but the route usually takes the GID or ID
    // Existing routes: /app/contracts/$id
    // ID from getContracts is likely a GID.
    // The existing app seems to use numeric ID in URL sometimes, but let's check.
    // In app.contracts._index, it navigates to `${contract.id.split('/').pop()}` usually.
    const numericId = id.split('/').pop();
    navigate(`/app/contracts/${numericId}`);
  };

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
                <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">Recent Contracts</Text>
                    <Button variant="plain" onClick={() => navigate("/app")} icon={ArrowRightIcon}>View all</Button>
                </InlineStack>
                {recentContracts.length === 0 ? (
                    <EmptySearchResult
                        title="No contracts found"
                        description="Create a subscription contract to get started"
                        withIllustration
                    />
                ) : (
                    <IndexTable
                        resourceName={{singular: 'contract', plural: 'contracts'}}
                        itemCount={recentContracts.length}
                        headings={[
                            {title: 'ID'},
                            {title: 'Customer'},
                            {title: 'Status'},
                            {title: 'Next Billing'},
                        ]}
                        selectable={false}
                    >
                        {recentContracts.map((contract, index) => (
                            <IndexTable.Row 
                                id={contract.id} 
                                key={contract.id} 
                                position={index}
                                onClick={() => handleContractClick(contract.id)}
                            >
                                <IndexTable.Cell>
                                    <Text as="span" variant="bodyMd" fontWeight="bold">
                                        {contract.id.split('/').pop()}
                                    </Text>
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                    {contract.customer.displayName}
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                    <Badge tone={contract.status === 'ACTIVE' ? 'success' : undefined}>
                                        {contract.status}
                                    </Badge>
                                </IndexTable.Cell>
                                <IndexTable.Cell>
                                    {contract.nextBillingDate ? formatDateTime(contract.nextBillingDate, i18n.language) : '-'}
                                </IndexTable.Cell>
                            </IndexTable.Row>
                        ))}
                    </IndexTable>
                )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
            <Card>
                <BlockStack gap="400">
                    <InlineStack align="space-between">
                        <Text as="h2" variant="headingMd">Recent Customers</Text>
                        <Button variant="plain" onClick={() => navigate("/app/customers")} icon={ArrowRightIcon}>View all</Button>
                    </InlineStack>
                    <BlockStack gap="300">
                        {recentCustomers.map((customer: any) => (
                             <BlockStack key={customer.id} gap="100">
                                <Text as="p" variant="bodyMd" fontWeight="bold">{customer.displayName || 'Unknown'}</Text>
                                <Text as="p" variant="bodySm" tone="subdued">{customer.email || 'No email'}</Text>
                             </BlockStack>
                        ))}
                        {recentCustomers.length === 0 && <Text as="p" tone="subdued">No customers found</Text>}
                    </BlockStack>
                </BlockStack>
            </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

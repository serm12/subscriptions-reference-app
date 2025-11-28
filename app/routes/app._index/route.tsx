import {json} from '@remix-run/node';
import {useLoaderData, useNavigate} from '@remix-run/react';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Button,
  ProgressBar,
  Box,
  Divider,
  MediaCard,
  VideoThumbnail,
  Icon,
} from '@shopify/polaris';
import {
  CheckIcon,
  XIcon
} from '@shopify/polaris-icons';
import {authenticate} from '~/shopify.server';
import {getContracts} from '~/models/SubscriptionContract/SubscriptionContract.server';
import {getSellingPlanGroups} from '~/models/SellingPlan/SellingPlan.server';
import {useTranslation} from 'react-i18next';

export async function loader({request}: {request: Request}) {
  const {admin} = await authenticate.admin(request);

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();

  const [
    sellingPlanGroupsResult,
    allContractsResult,
    activeContractsResult,
    newContractsResult,
    cancelledContractsResult
  ] = await Promise.all([
    getSellingPlanGroups(admin.graphql, {first: 1}),
    getContracts(admin.graphql, {first: 1}),
    getContracts(admin.graphql, {first: 50, query: `status:ACTIVE`}),
    getContracts(admin.graphql, {first: 50, query: `created_at:>=${sevenDaysAgoIso}`}),
    getContracts(admin.graphql, {first: 50, query: `status:CANCELLED AND updated_at:>=${sevenDaysAgoIso}`}),
  ]);

  const hasSellingPlans = sellingPlanGroupsResult.sellingPlanGroups.length > 0;
  const hasContracts = allContractsResult.subscriptionContracts.length > 0;
  
  const activeCount = activeContractsResult.subscriptionContracts.length;
  const newCount = newContractsResult.subscriptionContracts.length;
  const cancelledCount = cancelledContractsResult.subscriptionContracts.length;

  return json({
    hasSellingPlans,
    hasContracts,
    activeCount,
    newCount,
    cancelledCount,
    dateRange: `${sevenDaysAgo.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}-${today.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`
  });
}

export default function Dashboard() {
  const {
    hasSellingPlans,
    hasContracts,
    activeCount,
    newCount,
    cancelledCount,
    dateRange
  } = useLoaderData<typeof loader>();
  
  const navigate = useNavigate();
  const {t} = useTranslation();

  // Calculate progress
  // Steps:
  // 1. Create your first subscription plan
  // 2. Import existing contracts
  // 3. Add subscriptions to product pages
  // 4. Allow customers to manage subscriptions
  // 5. Allow customer to access account post purchase
  // 6. Customize notifications
  
  // We only dynamically check 1 and 2 for now.
  // We can assume 3-6 are false for this reference implementation or static.
  // The image shows 1/6 completed (only Import existing contracts checked).
  // Let's make it dynamic based on our checks.
  
  const steps = [
    {
      label: 'Create your first subscription plan',
      description: 'Get more repeat business by allowing customers to purchase products or services on a recurring basis',
      completed: hasSellingPlans,
      action: {
        content: 'Create plan',
        onAction: () => navigate('/app/plans/new')
      }
    },
    {
      label: 'Import existing contracts',
      completed: hasContracts,
    },
    {
      label: 'Add subscriptions to product pages',
      completed: false,
    },
    {
      label: 'Allow customers to manage subscriptions',
      completed: false,
    },
    {
      label: 'Allow customer to access account post purchase',
      completed: false,
    },
    {
      label: 'Customize notifications',
      completed: false,
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <Page title="Get started with Shopify Subscriptions">
      <BlockStack gap="500">
        {/* Setup Guide */}
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
                <InlineStack align="space-between">
                    <Text as="h2" variant="headingSm">Setup guide</Text>
                    <Button variant="plain" icon={XIcon}>Dismiss</Button> 
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">{completedSteps} / {steps.length} completed</Text>
                <ProgressBar progress={progress} size="small" tone="primary" />
            </BlockStack>
            
            <BlockStack gap="400">
                {steps.map((step, index) => (
                    <InlineStack key={index} gap="300" align="start" blockAlign="start">
                        <Box paddingBlockStart="050">
                            {step.completed ? (
                                <Icon source={CheckIcon} tone="success" />
                            ) : (
                                <div style={{color: 'var(--p-color-icon-disabled)'}}>
                                    <div style={{
                                        width: 20, 
                                        height: 20, 
                                        borderRadius: '50%', 
                                        border: '1px solid currentColor',
                                        boxSizing: 'border-box'
                                    }} />
                                </div>
                            )}
                        </Box>
                        <BlockStack gap="100">
                            <Text as="p" variant="bodyMd" fontWeight={!step.completed && index === 0 ? "bold" : "regular"}>
                                {step.label}
                            </Text>
                            {step.description && !step.completed && (
                                <Text as="p" variant="bodyMd" tone="subdued">
                                    {step.description}
                                </Text>
                            )}
                            {step.action && !step.completed && (
                                <Box paddingBlockStart="200">
                                    <Button onClick={step.action.onAction} variant="primary">
                                        {step.action.content}
                                    </Button>
                                </Box>
                            )}
                        </BlockStack>
                    </InlineStack>
                ))}
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Performance */}
        <BlockStack gap="200">
            <InlineStack gap="200" align="start">
                 <Text as="h2" variant="headingSm">Performance</Text>
                 <Text as="span" tone="subdued" variant="bodySm">{dateRange}</Text>
            </InlineStack>
            
            <Card>
                <InlineStack gap="800" align="start">
                    <BlockStack gap="100">
                         <InlineStack gap="100">
                             <Text as="p" variant="bodyMd" fontWeight="bold">Subscriptions revenue</Text>
                         </InlineStack>
                         <Text as="h2" variant="headingLg">$0</Text>
                         <div style={{height: 4, width: 50, backgroundColor: '#008060', borderRadius: 2}}></div>
                    </BlockStack>

                    <BlockStack gap="100">
                         <InlineStack gap="100">
                             <Text as="p" variant="bodyMd" fontWeight="bold">Active subscriptions</Text>
                         </InlineStack>
                         <Text as="h2" variant="headingLg">{activeCount}</Text>
                         <div style={{height: 4, width: 50, backgroundColor: '#008060', borderRadius: 2}}></div>
                    </BlockStack>

                    <BlockStack gap="100">
                         <InlineStack gap="100">
                             <Text as="p" variant="bodyMd" fontWeight="bold">New subscriptions</Text>
                         </InlineStack>
                         <Text as="h2" variant="headingLg">{newCount}</Text>
                         <div style={{height: 4, width: 50, backgroundColor: '#008060', borderRadius: 2}}></div>
                    </BlockStack>

                    <BlockStack gap="100">
                         <InlineStack gap="100">
                             <Text as="p" variant="bodyMd" fontWeight="bold">Cancelled subscriptions</Text>
                         </InlineStack>
                         <Text as="h2" variant="headingLg">{cancelledCount}</Text>
                         <div style={{height: 4, width: 50, backgroundColor: '#008060', borderRadius: 2}}></div>
                    </BlockStack>
                </InlineStack>
            </Card>
        </BlockStack>

        {/* Promo Card */}
        <MediaCard
            title="Increase recurring revenue and build customer loyalty"
            primaryAction={{
                content: 'Read blog post',
                onAction: () => {},
            }}
            secondaryAction={{
                content: 'Learn more',
                onAction: () => {},
            }}
            description="Easily set up and manage simple subscription offerings with the new, free Shopify Subscriptions app. With new customer accounts, your customers will have the flexibility to pause or skip orders, update payment and shipping details, and more."
            popoverActions={[{content: 'Dismiss', onAction: () => {}}]}
        >
            <VideoThumbnail
                videoLength={80}
                thumbnailUrl="https://cdn.shopify.com/s/files/1/0070/7032/files/shopify-subscriptions-app-thumbnail.jpg?v=1697136000"
                onClick={() => console.log('clicked')}
            />
        </MediaCard>
      </BlockStack>
    </Page>
  );
}
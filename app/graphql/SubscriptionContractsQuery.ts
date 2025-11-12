const SubscriptionContracts = `#graphql
query SubscriptionContracts(
  $first: Int
  $last: Int
  $before: String
  $after: String,
  $query: String,
  $sortKey: SubscriptionContractsSortKeys,
  $reverse: Boolean,
) {
  subscriptionContracts(
    first: $first
    last: $last
    before: $before
    after: $after
    query: $query
    sortKey: $sortKey
    reverse: $reverse,
  ) {
    edges {
      node {
        id
        currencyCode
        customer {
          id
          displayName
        }
        status
        nextBillingDate
        originOrder {
          createdAt
        }
        deliveryPolicy {
          interval
          intervalCount
        }
        linesCount {
          count
        }
        billingAttempts(first: 1, reverse: true) {
          edges {
            node {
              id
              createdAt
              errorCode
              processingError {
                code
                ... on SubscriptionBillingAttemptInsufficientStockProductVariantsError {
                  insufficientStockProductVariants(first: 5) {
                    edges {
                      node {
                        id
                        title
                        image {
                          url
                          altText
                        }
                        product {
                          featuredMedia {
                            preview {
                              image {
                                altText
                                url
                              }
                            }
                          }
                          id
                          title
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        lines(first: 50) {
          edges {
            node {
              id
              productId
              title
              variantTitle
              quantity
              currentPrice {
                currencyCode
                amount
              }
              variantImage {
                url
                altText
              }
              lineDiscountedPrice {
                amount
                currencyCode
              }
              pricingPolicy {
                basePrice {
                  currencyCode
                  amount
                }
                cycleDiscounts {
                  adjustmentType
                  adjustmentValue {
                    ... on MoneyV2 {
                      amount
                      currencyCode
                    }
                    ... on SellingPlanPricingPolicyPercentageValue {
                      percentage
                    }
                  }
                }
              }
            }
          }
        }
              }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
      startCursor
    }
  }
  contractsWithInventoryError: subscriptionContracts(
    first: 1,
    query: "NOT status:CANCELLED AND last_billing_attempt_error_type:inventory_error",
  ) {
    edges {
      node {
        id
      }
    }
  }
}
`;

export default SubscriptionContracts;

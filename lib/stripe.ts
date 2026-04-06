import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLANS = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_MONTHLY!,
    price: '$4.99',
    interval: 'month',
  },
  yearly: {
    priceId: process.env.STRIPE_PRICE_YEARLY!,
    price: '$50',
    interval: 'year',
  },
} as const

export type PlanKey = keyof typeof PLANS

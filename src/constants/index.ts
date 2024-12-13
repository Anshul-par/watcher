export const GOOGLE_SUBSCRIPTION_EVENTS = [
  {
    id: "1",
    name: "SUBSCRIPTION_RECOVERED",
    description: "A subscription was recovered from account hold.",
  },
  {
    id: "2",
    name: "SUBSCRIPTION_RENEWED",
    description: "An active subscription was renewed.",
  },
  {
    id: "3",
    name: "SUBSCRIPTION_CANCELED",
    description:
      "A subscription was either voluntarily or involuntarily cancelled. For voluntary cancellation, sent when the user cancels.",
  },
  {
    id: "4",
    name: "SUBSCRIPTION_PURCHASED",
    description: "A new subscription was purchased.",
  },
  {
    id: "5",
    name: "SUBSCRIPTION_ON_HOLD",
    description: "A subscription has entered account hold (if enabled).",
  },
  {
    id: "6",
    name: "SUBSCRIPTION_IN_GRACE_PERIOD",
    description: "A subscription has entered grace period (if enabled).",
  },
  {
    id: "7",
    name: "SUBSCRIPTION_RESTARTED",
    description:
      "User has restored their subscription from Play > Account > Subscriptions. The subscription was canceled but had not expired yet when the user restores.",
  },
  {
    id: "8",
    name: "SUBSCRIPTION_PRICE_CHANGE_CONFIRMED",
    description:
      "A subscription price change has successfully been confirmed by the user.",
  },
  {
    id: "9",
    name: "SUBSCRIPTION_DEFERRED",
    description: "A subscription's recurrence time has been extended.",
  },
  {
    id: "10",
    name: "SUBSCRIPTION_PAUSED",
    description: "A subscription has been paused.",
  },
  {
    id: "11",
    name: "SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED",
    description: "A subscription pause schedule has been changed.",
  },
  {
    id: "12",
    name: "SUBSCRIPTION_REVOKED",
    description:
      "A subscription has been revoked from the user before the expiration time.",
  },
  {
    id: "13",
    name: "SUBSCRIPTION_EXPIRED",
    description: "A subscription has expired.",
  },
  {
    id: "20",
    name: "SUBSCRIPTION_PENDING_PURCHASE_CANCELED",
    description: "A pending transaction of a subscription has been canceled.",
  },
];

export const ENV_GOOGLE_PUBSUB_MAP = {
  dev: "projects/chathub-flutter/subscriptions/subscription_android_dev",
  prod: "projects/chathub-flutter/subscriptions/subsription_android",
};

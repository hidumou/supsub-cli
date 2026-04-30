export const demoUser = {
  id: 1,
  email: "demo@supsub.local",
  name: "Demo",
  avatar: "",
  google: false,
  expired: false,
  endAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // now + 30 days
  opml: "http://localhost:8787/feed/demo/opml.xml",
  onboardingCompleted: true,
  referralSourceSubmitted: true,
};

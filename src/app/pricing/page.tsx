import React from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Image from "next/image";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - UiCore PRO",
  description: "Choose the right plan for your needs. UiCore PRO offers affordable plans for WordPress websites with a 30-day money back guarantee.",
};

interface PricingCardProps {
  title: string;
  subtitle: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaLink: string;
  featured?: boolean;
  onetime?: boolean;
}

const PricingCard = ({
  title,
  subtitle,
  price,
  period,
  description,
  features,
  ctaText,
  ctaLink,
  featured = false,
  onetime = false,
}: PricingCardProps) => {
  return (
    <Card className={`overflow-hidden ${featured ? 'bg-black text-white' : 'bg-white'}`}>
      <CardHeader className="p-6">
        <h3 className="text-xl font-bold mb-1">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="mb-6">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">${price}</span>
            <span className="ml-2 text-gray-500 dark:text-gray-400">/{period}</span>
          </div>
          {onetime && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">one-time payment</div>
          )}
        </div>
        <p className="text-sm mb-6">{description}</p>
        <Button
          asChild
          className={`w-full ${featured ? 'bg-uicore-green hover:bg-uicore-green/90' : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'}`}
        >
          <Link href={ctaLink}>{ctaText}</Link>
        </Button>
      </CardContent>
      <CardFooter className="p-6 pt-4 flex flex-col items-start">
        <div className="text-sm font-medium mb-4">Included with your {onetime ? 'purchase' : 'subscription'}:</div>
        <ul className="space-y-2 w-full">
          {features.map((feature, i) => (
            <li key={i} className="flex text-sm">
              <CheckIcon className="h-5 w-5 text-uicore-green flex-shrink-0 mr-3" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardFooter>
    </Card>
  );
};

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <section className="py-20 bg-zinc-50">
          <div className="uicore-container">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Join the PRO community</h1>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                With UiCore PRO you can build unlimited websites, personalize the theme with your own brand style, and access all UiCore Framework features, all in one affordable yearly subscription.
              </p>
              <div className="flex justify-center mt-6">
                <p className="text-sm inline-flex items-center">
                  <Image
                    src="https://ext.same-assets.com/3721558169/2425112280.webp"
                    alt="Trusted by"
                    width={80}
                    height={20}
                    className="h-5 w-auto mr-2"
                  />
                  Trusted by 20,000+ users
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <PricingCard
                title="Single Website"
                subtitle="1 Website"
                price="59"
                period="year"
                description="Ideal for entrepreneurs and small businesses looking to establish a strong online presence."
                ctaText="Get started now"
                ctaLink="#"
                features={[
                  "Access to ready-made websites",
                  "Access to Template Library",
                  "UiCore Framework",
                  "MetForm Pro: Visual Form Builder (save $179)",
                  "Element Pack Pro: Elementor Addon (save $58)",
                  "UiCore Animate: Elementor Animations",
                  "UiCore Elements: Premium Elementor Widgets",
                  "Premium theme support for 1 year",
                  "Regular theme updates for 1 year",
                ]}
              />

              <PricingCard
                title="Agency"
                subtitle="Unlimited Websites"
                price="159"
                period="year"
                description="For agencies, freelancers, or design enthusiasts dedicated to crafting extraordinary websites."
                ctaText="Get started now"
                ctaLink="#"
                features={[
                  "Access to ready-made websites",
                  "Access to Template Library",
                  "UiCore Framework",
                  "MetForm Pro: Visual Form Builder (save $179)",
                  "Element Pack Pro: Elementor Addon (save $236)",
                  "UiCore Animate: Elementor Animations",
                  "UiCore Elements: Premium Elementor Widgets",
                  "Premium theme support for 1 year",
                  "Regular theme updates for 1 year",
                  "White-Label Manager",
                ]}
              />

              <PricingCard
                title="Lifetime"
                subtitle="Unlimited Websites, Lifetime Access"
                price="999"
                period=""
                onetime={true}
                description="Ideal for those seeking permanent access to all features and updates with no renewal fees, ever."
                ctaText="Get lifetime access"
                ctaLink="#"
                featured={true}
                features={[
                  "Access to ready-made websites",
                  "Access to Template Library",
                  "UiCore Framework",
                  "MetForm Pro: Visual Form Builder (save $179)",
                  "Element Pack Pro: Elementor Addon (save $236)",
                  "UiCore Animate: Elementor Animations",
                  "UiCore Elements: Premium Elementor Widgets",
                  "Premium theme support for life",
                  "Regular theme updates for life",
                  "White-Label Manager",
                ]}
              />
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200 mb-20">
              <div className="flex items-center">
                <div className="mr-3">
                  <Image
                    src="https://ext.same-assets.com/1590579384/1352741033.svg+xml"
                    alt="News icon"
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                </div>
                <p className="text-sm"><strong>Big news!</strong> We're hard at work on UiCore PRO for Gutenberg, and after the public launch, it will be included for free with every plan.</p>
                <div className="ml-3">
                  <Image
                    src="https://ext.same-assets.com/952209820/3573150476.svg+xml"
                    alt="Get ready"
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                </div>
                <p className="text-sm ml-1">Get ready for premium tools at no extra cost!</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between mb-16">
              <div className="mb-8 md:mb-0 md:mr-8">
                <Image
                  src="https://ext.same-assets.com/2665110399/1340907172.svg+xml"
                  alt="Money back guarantee"
                  width={60}
                  height={60}
                  className="h-16 w-auto mb-4"
                />
                <h2 className="text-2xl font-bold mb-4">30 day money back guarantee</h2>
                <p className="text-gray-600 max-w-2xl">
                  We believe in our products, but we get it — they might not be for everyone. If you're not happy with your purchase, no worries! We'll gladly refund your money within 30 days of purchase.
                </p>
              </div>
              <div>
                <Image
                  src="https://ext.same-assets.com/2218488027/1887486459.svg+xml"
                  alt="Trustpilot"
                  width={200}
                  height={80}
                  className="w-full max-w-[200px] h-auto"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 divide-y">
              <h2 className="text-2xl font-bold p-8">Frequently Asked Questions</h2>

              <div className="p-8">
                <h3 className="text-lg font-semibold mb-4">How many sites can I use UiCore Pro on?</h3>
                <p className="text-gray-600">
                  The Single Website License permits the use of the theme on one website only, whereas the Agency License grants usage rights across an unlimited number of websites.
                </p>
              </div>

              <div className="p-8">
                <h3 className="text-lg font-semibold mb-4">Will I have access to all your other themes on ThemeForest?</h3>
                <p className="text-gray-600">
                  No. Even though it uses the same framework, UiCore PRO is a different theme that has its own set of templates. If you need to use a template from our other themes, you will need to purchase one license / website from ThemeForest.
                </p>
              </div>

              <div className="p-8">
                <h3 className="text-lg font-semibold mb-4">How do I get updates?</h3>
                <p className="text-gray-600">
                  You will get a notification in your Theme Options panel whenever an update is available. You can update it automatically with just a click.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

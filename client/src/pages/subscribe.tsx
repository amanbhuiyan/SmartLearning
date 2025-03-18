import { useEffect, useState } from 'react';
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// Only initialize Stripe if the key is available
let stripePromise;
if (import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  import('@stripe/stripe-js').then(({ loadStripe }) => {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  });
}

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [stripeComponents, setStripeComponents] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (stripePromise) {
      import('@stripe/react-stripe-js').then((module) => {
        setStripeComponents(module);
      });
    }
  }, []);

  // If Stripe is not configured, show a message
  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Service</CardTitle>
              <CardDescription>
                Subscription service is temporarily unavailable. You can continue using the trial version.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setLocation("/")}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const SubscribeForm = () => {
    if (!stripeComponents) return null;

    const { useStripe, useElements, PaymentElement } = stripeComponents;
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!stripe || !elements) {
        return;
      }

      setIsProcessing(true);

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('Payment failed:', error);
      }

      setIsProcessing(false);
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <PaymentElement />
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing} 
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Subscribe Now - £2/week"
          )}
        </Button>
      </form>
    );
  };

  // Show loading state while fetching client secret
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Subscribe to EduQuest</CardTitle>
            <CardDescription>
              Your first week is free! Then just £2/week for unlimited access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeComponents && stripePromise && (
              <stripeComponents.Elements stripe={stripePromise} options={{ appearance: { theme: 'stripe' } }}>
                <SubscribeForm />
              </stripeComponents.Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
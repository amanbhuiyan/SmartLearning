import { useEffect, useState } from 'react';
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useToast } from "@/hooks/use-toast";

// Initialize Stripe with the public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripeResponse {
  clientSecret: string;
  subscriptionId: string;
}

interface SubscribeFormProps {
  clientSecret: string;
}

const SubscribeForm = ({ clientSecret }: SubscribeFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const { error: paymentError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard`,
        },
      });

      if (paymentError) {
        setError(paymentError.message || "An error occurred with your payment");
        toast({
          variant: "destructive",
          title: "Payment Failed",
          description: paymentError.message || "An error occurred with your payment",
        });
      }
    } catch (err) {
      const errorMessage = "An unexpected error occurred";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: errorMessage,
      });
      console.error("Payment error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
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

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializePayment = async () => {
      try {
        const response = await apiRequest<StripeResponse>('/api/get-or-create-subscription', {
          method: 'POST',
        });

        if (response?.clientSecret) {
          setClientSecret(response.clientSecret);
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to initialize payment. Please try again later.';
        console.error('Failed to initialize payment:', err);
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Subscription Error",
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    // If user is not authenticated, redirect to auth page
    if (!user) {
      setLocation("/auth");
      return;
    }

    // Already subscribed users should be redirected to dashboard
    if (user.isSubscribed) {
      setLocation("/");
      return;
    }

    initializePayment();
  }, [user, setLocation, toast]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>{error}</CardDescription>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Subscribe to Smart Learning</CardTitle>
            <CardDescription>
              Your first week is free! Then just £2/week for unlimited access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientSecret && stripePromise && (
              <Elements 
                stripe={stripePromise} 
                options={{
                  clientSecret,
                  appearance: { theme: 'stripe' },
                }}
              >
                <SubscribeForm clientSecret={clientSecret} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
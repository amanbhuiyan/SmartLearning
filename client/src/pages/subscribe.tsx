import { useEffect, useState } from 'react';
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useToast } from "@/hooks/use-toast";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripeResponse {
  subscriptionId: string;
  clientSecret: string;
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Payment system not initialized properly",
      });
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
    if (!user) {
      setLocation("/auth");
      return;
    }

    if (user.isSubscribed) {
      setLocation("/dashboard");
      return;
    }

    const initializePayment = async () => {
      try {
        console.log("Initializing payment...");
        const response = await fetch('/api/get-or-create-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Payment initialization response:", data);

        if (data.error) {
          throw new Error(data.error.message || 'Failed to initialize payment');
        }

        if (!data.clientSecret) {
          throw new Error('No client secret received');
        }

        setClientSecret(data.clientSecret);
      } catch (err: any) {
        console.error('Failed to initialize payment:', err);
        const errorMessage = err.message || 'Failed to initialize payment. Please try again later.';
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

    initializePayment();
  }, [user, setLocation, toast]);

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
            <CardTitle>Subscribe to Smart Learning</CardTitle>
            <CardDescription>
              Your first week is free! Then just £2/week for unlimited access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center space-y-4">
                <p className="text-destructive">{error}</p>
                <Button onClick={() => setLocation("/dashboard")}>
                  Return to Dashboard
                </Button>
              </div>
            ) : clientSecret ? (
              <Elements 
                stripe={stripePromise} 
                options={{
                  clientSecret,
                  appearance: { theme: 'stripe' },
                }}
              >
                <SubscribeForm clientSecret={clientSecret} />
              </Elements>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
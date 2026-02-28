"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';


const solanaConnectors = toSolanaWalletConnectors();

import { auth, db, logFirebaseEvent } from "@/services/firebase.service";
import { onAuthStateChanged, TwitterAuthProvider, signInWithPopup, User, getAdditionalUserInfo } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  ready: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  twitterObj: {
    twitterId: string | undefined;
    name: string | null | undefined;
    username: any;
  } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleTwitterLogin = async () => {
    const provider = new TwitterAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // const additionalUserInfo = getAdditionalUserInfo(result);
      logFirebaseEvent("login", {
        method: "twitter",
        user_id: user.uid,
      });

      // Successfully logged in
    } catch (error) {
      console.error("Error signing in with Twitter:", error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      
      logFirebaseEvent("logout", {
        user_id: user?.uid,
      });

      setUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const extractTwitterProps = () => {
    if (!user) return null;
    const twitterInfo = user.providerData.find(
      (p) => p.providerId === "twitter.com"
    );
    const twitterId = twitterInfo?.uid;
    const name = twitterInfo?.displayName;
    const username = (user as any)?.reloadUserInfo?.screenName || "";
    return { twitterId, name, username };
  };

  const value: AuthContextType = {
    user,
    loading,
    authenticated: !!user,
    ready: !loading,
    login: handleTwitterLogin,
    logout: handleLogout,
    twitterObj: extractTwitterProps(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
          walletChainType: "solana-only",
          walletList: ["phantom", "solflare", "detected_solana_wallets"],
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        // embeddedWallets: {
        //   solana: {
        //     createOnLogin: "users-without-wallets",
        //   },
        // },
      }}
    >
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}


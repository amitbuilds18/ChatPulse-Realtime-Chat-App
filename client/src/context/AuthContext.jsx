import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("chat_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("chat_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem("chat_token");
      if (storedToken) {
        try {
          const res = await api.get("/auth/me");
          setUser(res.data.user);
          localStorage.setItem("chat_user", JSON.stringify(res.data.user));
        } catch (err) {
          console.warn("Session expired:", err.message);
          setUser(null);
          setToken(null);
          localStorage.removeItem("chat_token");
          localStorage.removeItem("chat_user");
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token: receivedToken, user: receivedUser } = res.data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem("chat_token", receivedToken);
    localStorage.setItem("chat_user", JSON.stringify(receivedUser));
    return receivedUser;
  };

  const register = async (name, email, password, phone) => {
    const res = await api.post("/auth/register", { name, email, password, phone });
    const { token: receivedToken, user: receivedUser } = res.data;
    setToken(receivedToken);
    setUser(receivedUser);
    localStorage.setItem("chat_token", receivedToken);
    localStorage.setItem("chat_user", JSON.stringify(receivedUser));
    return receivedUser;
  };

  const updateUserPhone = async (phone) => {
    const res = await api.put("/auth/phone", { phone });
    const updatedUser = res.data.user;
    setUser(updatedUser);
    localStorage.setItem("chat_user", JSON.stringify(updatedUser));
    return updatedUser;
  };

  const updateUserProfile = async ({ name, avatar_url, status_text }) => {
    const res = await api.put("/auth/profile", { name, avatar_url, status_text });
    const updatedUser = res.data.user;
    setUser(updatedUser);
    localStorage.setItem("chat_user", JSON.stringify(updatedUser));
    return updatedUser;
  };

  const sendOtpToPhone = async (phone) => {
    const res = await api.post("/auth/send-otp", { phone });
    return res.data;
  };

  const verifyPhoneOtp = async (phone, otp) => {
    const res = await api.post("/auth/verify-otp", { phone, otp });
    const updatedUser = {
      ...user,
      phone,
      phone_verified: true
    };
    setUser(updatedUser);
    localStorage.setItem("chat_user", JSON.stringify(updatedUser));
    return res.data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("chat_token");
    localStorage.removeItem("chat_user");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, updateUserPhone, updateUserProfile, sendOtpToPhone, verifyPhoneOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

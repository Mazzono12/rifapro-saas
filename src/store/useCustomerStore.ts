import { create } from "zustand";
import type { Customer } from "../types";

const customerSessionKey = "nexusdraw_customer";
const browserIdKey = "nexusdraw_browser_id";
const customerCookieMaxAge = 60 * 60 * 24 * 180;

function readCookieValue(name: string) {
  return document.cookie
    .split("; ")
    .find(item => item.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";
}

function ensureBrowserId() {
  const fromCookie = readCookieValue(browserIdKey);
  if (fromCookie) {
    localStorage.setItem(browserIdKey, decodeURIComponent(fromCookie));
    return decodeURIComponent(fromCookie);
  }

  const fromStorage = localStorage.getItem(browserIdKey);
  if (fromStorage) {
    document.cookie = `${browserIdKey}=${encodeURIComponent(fromStorage)}; Max-Age=${customerCookieMaxAge}; Path=/; SameSite=Lax`;
    return fromStorage;
  }

  const nextId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(browserIdKey, nextId);
  document.cookie = `${browserIdKey}=${encodeURIComponent(nextId)}; Max-Age=${customerCookieMaxAge}; Path=/; SameSite=Lax`;
  return nextId;
}

function createCookieCustomer(customer: Customer): Customer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    cpf: customer.cpf,
    browserId: customer.browserId || ensureBrowserId(),
    photoUrl: customer.photoUrl,
    createdAt: customer.createdAt,
    totalTickets: customer.totalTickets,
    affiliateRefCode: customer.affiliateRefCode,
    referredBy: customer.referredBy,
    city: customer.city,
    state: customer.state,
    latitude: customer.latitude,
    longitude: customer.longitude,
  };
}

function createStoredCustomer(customer: Customer): Customer {
  const { accessPassword, ...safeCustomer } = customer;
  return safeCustomer;
}

function writeCustomerCookie(customer: Customer) {
  const browserId = customer.browserId || ensureBrowserId();
  document.cookie = `${customerSessionKey}=${encodeURIComponent(JSON.stringify(createCookieCustomer({ ...customer, browserId })))}; Max-Age=${customerCookieMaxAge}; Path=/; SameSite=Lax`;
}

function readCustomerCookie() {
  const cookie = document.cookie
    .split("; ")
    .find(item => item.startsWith(`${customerSessionKey}=`));
  if (!cookie) return null;

  try {
    return JSON.parse(decodeURIComponent(cookie.split("=").slice(1).join("="))) as Customer;
  } catch {
    return null;
  }
}

function clearCustomerCookie() {
  document.cookie = `${customerSessionKey}=; Max-Age=0; Path=/; SameSite=Lax`;
}

interface CustomerState {
  customer: Customer | null;
  setCustomer: (customer: Customer) => void;
  clearCustomer: () => void;
  hydrate: () => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customer: null,
  setCustomer: (customer) => {
    const browserId = customer.browserId || ensureBrowserId();
    const trackedCustomer = createStoredCustomer({ ...customer, browserId });
    localStorage.setItem(customerSessionKey, JSON.stringify(trackedCustomer));
    writeCustomerCookie(trackedCustomer);
    set({ customer: trackedCustomer });
  },
  clearCustomer: () => {
    localStorage.removeItem(customerSessionKey);
    clearCustomerCookie();
    set({ customer: null });
  },
  hydrate: () => {
    const browserId = ensureBrowserId();
    const cookieCustomer = readCustomerCookie();
    if (cookieCustomer) {
      const trackedCustomer = createStoredCustomer({ ...cookieCustomer, browserId: cookieCustomer.browserId || browserId });
      localStorage.setItem(customerSessionKey, JSON.stringify(trackedCustomer));
      writeCustomerCookie(trackedCustomer);
      set({ customer: trackedCustomer });
      return;
    }

    const raw = localStorage.getItem(customerSessionKey);
    if (!raw) return;

    try {
      const customer = createStoredCustomer({ ...(JSON.parse(raw) as Customer), browserId });
      writeCustomerCookie(customer);
      localStorage.setItem(customerSessionKey, JSON.stringify(customer));
      set({ customer });
    } catch {
      localStorage.removeItem(customerSessionKey);
      clearCustomerCookie();
    }
  },
}));

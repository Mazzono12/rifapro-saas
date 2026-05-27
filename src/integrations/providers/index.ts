import { BaseProvider } from "../core/BaseProvider";
import { PlaceholderProvider } from "./placeholder/PlaceholderProvider";
import { PrimePagProvider } from "./primepag/PrimePagProvider";
import { PaggueProvider } from "./paggue/PaggueProvider";
import { MetaAdsProvider } from "./metaAds/MetaAdsProvider";
import { GoogleAdsProvider } from "./googleAds/GoogleAdsProvider";
import { SmtpProvider } from "./smtp/SmtpProvider";
import { SendPulseProvider } from "./sendpulse/SendPulseProvider";
import { NuvendeProvider } from "./nuvende/NuvendeProvider";
import { providerCatalog } from "./catalog";

export function createDefaultProviders(): BaseProvider[] {
  return [
    new PrimePagProvider(),
    new PaggueProvider(),
    new SmtpProvider(),
    new SendPulseProvider(),
    new NuvendeProvider(),
    new MetaAdsProvider(),
    new GoogleAdsProvider(),
    new PlaceholderProvider("wetalkie", "whatsapp", providerCatalog.wetalkie.requiredCredentials, providerCatalog.wetalkie.notes),
    new PlaceholderProvider("fkeProcessor", "pix", providerCatalog.fkeProcessor.requiredCredentials, providerCatalog.fkeProcessor.notes),
    new PlaceholderProvider("cashPay", "pix", providerCatalog.cashPay.requiredCredentials, providerCatalog.cashPay.notes)
  ];
}

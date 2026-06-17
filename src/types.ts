export interface Raffle {
  id: string;
  title: string;
  description: string;
  price: number;
  totalTickets: number;
  soldTickets: number;
  minPurchaseTickets?: number;
  minimumTickets?: number;
  minQuantity?: number;
  reservationMinutes?: number;
  image: string; // Fallback or main image
  imageUrl?: string;
  bannerUrl?: string;
  coverImageUrl?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  videoUrl?: string;
  campaignMedia?: string | { url?: string; mediaUrl?: string; mediaType?: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny' };
  mediaType?: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  mediaAspect?: 'auto' | 'wide' | 'cinematic' | 'square' | 'portrait' | 'story';
  mediaFit?: 'cover' | 'contain' | 'fill';
  homeMediaLayout?: 'compact' | 'balanced' | 'vertical' | 'wide';
  checkoutMediaUrl?: string;
  checkoutMediaType?: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  checkoutMediaAspect?: 'auto' | 'wide' | 'cinematic' | 'square' | 'portrait' | 'story';
  checkoutMediaFit?: 'cover' | 'contain' | 'fill';
  videoConfig?: Partial<VideoPlayerConfig>;
  heroContentPlacement?: 'overlay' | 'below';
  heroEyebrow?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  homeTitle?: string;
  homeSubtitle?: string;
  homeHighlightText?: string;
  editionLabel?: string;
  homeEditionLabel?: string;
  heroPrimaryButton?: string;
  heroSecondaryText?: string;
  heroShowStats?: boolean;
  showHomePrice?: boolean;
  showHomeText?: boolean;
  showLivePurchaseFeed?: boolean;
  showSocialProofToast?: boolean;
  conversionProgressEnabled?: boolean;
  conversionProgressGoal?: number;
  conversionProgressLabel?: string;
  topSellerRewards?: TopSellerRewardConfig[];
  status: 'active' | 'completed' | 'draft' | 'paused' | 'cancelled';
  drawDate: string;
  countdownEnabled?: boolean;
  countdownEndAt?: string;
  salesEndAt?: string;
  manuallyClosedAt?: string;
  progressOverride?: number;
  countdownLabel?: string;
  pixConfig?: RafflePixConfig;
  n8nEnabled?: boolean;
  lootboxEnabled?: boolean;
  lootboxConfig?: LootboxConfig;
}

export interface TopSellerRewardConfig {
  position: number;
  label: string;
  enabled: boolean;
}

export interface VideoPlayerConfig {
  enabled: boolean;
  autoplay: boolean;
  allowPause: boolean;
  allowMute: boolean;
  allowRewind: boolean;
  startMuted: boolean;
  tapToUnmute: boolean;
  tapToTogglePlay: boolean;
  unmuteOnViewMotion: boolean;
  pauseAudioOnScroll: boolean;
  focusModeEnabled: boolean;
  autoFocusOnAutoplay: boolean;
  hideHeaderOnPlay: boolean;
  hideHeroInfoOnPlay: boolean;
  refocusOnTopDelaySeconds: number;
  autoplayCardsOnView: boolean;
  cardsAutoplayThreshold: number;
  initialVolume: number;
  showControls: boolean;
  labels?: {
    play?: string;
    pause?: string;
    mute?: string;
    unmute?: string;
    rewind?: string;
    tapToUnmute?: string;
    volume?: string;
  };
}

export interface LootboxRule {
  tickets: number;
  boxes: number;
}

export interface LootboxMilestone {
  tier: 'mini' | 'medio' | 'alto' | string;
  everyXTickets: number;
  name: string;
  type: string;
  value: number;
  currentCounter?: number;
  winnerName?: string;
}

export interface RewardWheelSegment {
  label: string;
  color: string;
  imageUrl?: string;
  rewardEnabled?: boolean;
  reward?: LootboxMilestone;
}

export interface LootboxConfig {
  experienceType?: 'box' | 'wheel';
  rewardModes?: {
    box: boolean;
    wheel: boolean;
  };
  ticketsPerBox: number;
  globalTicketsCounter?: number;
  boxRules: LootboxRule[];
  milestones: LootboxMilestone[];
  wheelSegments?: RewardWheelSegment[];
  effects?: {
    autoOpen?: boolean;
    sfx?: boolean;
    vfx?: boolean;
    confetti?: boolean;
  };
}

export interface FazendinhaLootboxConfig extends LootboxConfig {
  strategy?: 'group';
  winningGroupId?: string;
  boxesPerGroup?: number;
  prizeName?: string;
  prizeType?: string;
  prizeValue?: number;
  prizeRarity?: 'common' | 'rare' | 'epic' | 'legendary' | string;
  prizeClaimed?: boolean;
  winnerPurchaseId?: string;
}

export type PixGatewayId = 'mercadopago' | 'pagbank' | 'asaas' | 'infinitypay' | 'pay2m' | 'cora' | 'primepag' | 'paggue' | 'cashpay' | 'fakeprocessor' | 'sandbox' | 'mock';

export interface RafflePixConfig {
  inheritGlobal: boolean;
  enabled: boolean;
  gateway: PixGatewayId;
  sandbox: boolean;
  pixKey?: string;
  apiKey?: string;
  accessToken?: string;
  publicKey?: string;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookEvents?: string;
  releaseMode?: 'PAYMENT_RECEIVED' | 'PAYMENT_CONFIRMED' | string;
  orderExpirationMinutes?: string | number;
}

export interface InstantPrize {
  id: string;
  raffleId: string;
  numeroPremiado: number;
  valorPremio: number;
  status: 'available' | 'claimed';
  winnerName?: string;
}

export interface Story {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  duration: number; // admin can manipulate progress bar via duration
  active: boolean;
  link?: string;
  order?: number;
}

export interface Winner {
  id: string;
  raffleName: string;
  winnerName: string;
  prizeDescription: string;
  mediaUrl: string;
  mediaType: 'video' | 'image' | 'youtube' | 'vimeo' | 'bunny';
  date: string;
  sourceType?: string;
  status?: string;
  active?: boolean;
  city?: string;
  state?: string;
  category?: string;
  description?: string;
  prizeValue?: number;
}

export interface Purchase {
  purchaseId: string;
  raffleId: string;
  contact: string;
  tickets: number;
  numeros?: number[];
  premiosInstantaneos?: InstantPrize[];
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  pixPayload: string;
  pixGateway?: PixGatewayId | string;
  pixWebhookUrl?: string;
  createdAt: string;
  customer?: Customer;
  linkedPurchases?: Purchase[];
  paidWithBalance?: number;
  earnedLootboxes?: number;
  promotionSummary?: PromotionSummary;
  ticketWeights?: Array<{ number: number; weight: number; reason?: string }>;
  gamification?: {
    orderBump?: { offered: boolean; accepted: boolean; tickets: number; discountPercent: number; amount: number };
    luckyHour?: { applied: boolean; type?: string; value?: number; bonusTickets?: number; discount?: number; extraChance?: number };
    doubleTickets?: { applied: boolean; bonusTickets: number; minTickets: number; label: string };
    doubleChance?: { applied: boolean; weight: number };
    scratchcardEventId?: string;
    mysteryBoxEventId?: string;
    autoPrizes?: string[];
  };
}

export type PromotionType =
  | 'double_tickets'
  | 'buy_and_win'
  | 'pre_pix_upsell'
  | 'lucky_hour'
  | 'abandoned_pix_recovery'
  | 'package_bonus'
  | 'affiliate_bonus'
  | 'first_purchase_bonus'
  | 'vip_bonus'
  | 'buyer_ranking';

export interface PromotionRule {
  id: string;
  tenant_id: string;
  raffle_id?: string | null;
  raffleId?: string;
  name: string;
  type: PromotionType;
  enabled: boolean;
  priority: number;
  starts_at?: string | null;
  startsAt?: string;
  ends_at?: string | null;
  endsAt?: string;
  conditions: Record<string, unknown>;
  rewards: Record<string, unknown>;
  limits: Record<string, unknown>;
  stackable: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface PromotionSummary {
  appliedRules?: PromotionRule[];
  badges?: Array<{ label: string; type: PromotionType; promotionId: string }>;
  bonusTickets?: number;
  doubleTickets?: { applied: boolean; bonusTickets: number; minTickets?: number; label: string; promotionId?: string };
  rewards?: Array<{ promotionId: string; type: string; quantity: number; label: string; metadata?: Record<string, unknown> }>;
  upsellOffer?: { promotionId: string; label: string; description: string; extraTickets: number; extraAmount: number; rewardType: string; accepted?: boolean };
  luckyHour?: { applied: boolean; label: string; promotionId: string; bonusTickets?: number; rewardType?: string };
  recoveryMessages?: Array<{ delayMinutes: number; message: string; idempotencyKey: string }>;
  warnings?: string[];
}

export type GamificationModuleId = 'scratchcard' | 'winningTicket' | 'luckyHour' | 'mysteryBox' | 'doubleTickets' | 'doubleChance' | 'extremeTickets' | 'buyerRanking' | 'orderBump';

export interface GamificationConfig {
  tenant_id: string;
  raffleId: string;
  status: 'active' | 'inactive';
  modules: Record<GamificationModuleId, boolean>;
  scratchcard: { prizes: Array<{ id: string; name: string; type: string; value: number; stock: number; probability?: number; winnerName?: string }>; winProbability: number };
  winningTicket: { prizes: Array<{ id: string; number: number; prize: string; value: number; status: string }> };
  luckyHour: { windows: Array<{ id: string; startsAt: string; endsAt: string; type: 'bonus' | 'discount' | 'extraChance'; value: number; active: boolean }> };
  mysteryBox: { boxes: Array<{ id: string; label: string; prize: string; type: 'pix' | 'bonus' | 'empty'; value: number; status: string; winnerName?: string }> };
  doubleTickets: { startsAt: string; endsAt: string; minTickets: number; maxUsesPerCustomer: number; packageQuantities: number[]; label: string };
  doubleChance: { startsAt: string; endsAt: string; minTickets: number; weight: number };
  extremeTickets: { enabled: boolean; highPrize: string; lowPrize: string };
  buyerRanking: { visible: boolean; metric: 'tickets' | 'amount'; limit: number };
  orderBump: { enabled: boolean; tickets: number; discountPercent: number; label: string };
}

export interface GamificationEvent {
  tenant_id: string;
  id: string;
  raffleId: string;
  purchaseId: string;
  customerId?: string;
  module: GamificationModuleId;
  status: string;
  result?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

export interface GamificationWinner {
  tenant_id: string;
  id: string;
  raffleId: string;
  purchaseId: string;
  customerId?: string;
  module: GamificationModuleId;
  prize: string;
  value: number;
  number?: number;
  createdAt: string;
}

export interface Customer {
  tenant_id?: string;
  id: string;
  name: string;
  phone: string;
  cpf: string;
  browserId?: string;
  accessPassword?: string;
  photoUrl?: string;
  createdAt: string;
  totalTickets: number;
  affiliateRefCode: string;
  referredBy?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  affiliate?: AffiliateStats;
}

export interface AffiliateStats {
  refCode: string;
  clicks: number;
  conversions: number;
  referredCustomers: number;
  revenue: number;
  commission: number;
  commissionBalance?: number;
  prizeBalance?: number;
  pixKey?: string;
  useCustomCommission?: boolean;
  customCommissionRate?: number;
  useBalanceForPurchases: boolean;
  enabled: boolean;
  performanceRewardBalances?: {
    scratchcard?: number;
    wheel_spin?: number;
    super_quota?: number;
    bonus_number?: number;
    future_reward?: number;
  };
  performanceRewards?: Array<{
    id: string;
    tenant_id?: string;
    affiliateRefCode?: string;
    ruleId: string;
    ruleName: string;
    goalType: string;
    threshold: number;
    milestone: number;
    rewardType: string;
    rewardQuantity: number;
    source?: string;
    createdAt: string;
  }>;
  performanceRewardConsumptions?: Array<{
    id: string;
    tenant_id?: string;
    affiliateRefCode?: string;
    customerId?: string;
    rewardType: string;
    quantity: number;
    status: string;
    idempotencyKey?: string;
    result: {
      label: string;
      eventId?: string;
      lootboxId?: string;
      benefitQuantity?: number;
      message?: string;
    };
    createdAt: string;
  }>;
  rules?: {
    commissionRate: number;
    minTicketsToJoin: number;
    minWithdrawAmount: number;
    allowBalancePayments: boolean;
  };
  history: Array<{ amount: number; type: string; date: string }>;
}

export interface AffiliateWithdrawal {
  id: string;
  refCode: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  pixKey: string;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  requestedAt: string;
  paidAt?: string;
  adminNote?: string;
}

export interface SupportTicket {
  id: string;
  accessToken?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    sender: 'customer' | 'admin' | 'bot';
    body: string;
    createdAt: string;
    readByCustomer?: boolean;
    readByAdmin?: boolean;
  }>;
}

export type FazendinhaGroupStatus = 'available' | 'reserved' | 'sold';
export type FazendinhaRoundStatus = 'active' | 'paused' | 'closed';

export interface FazendinhaConfig {
  enabled: boolean;
  name: string;
  description: string;
  pricePerGroup: number;
  mainPrize: string;
  drawDate: string;
  resultNumber?: string;
  resultSource?: string;
  status: FazendinhaRoundStatus;
  reservationMinutes?: number;
  lootboxEnabled: boolean;
  lootboxConfig?: FazendinhaLootboxConfig;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'youtube' | 'vimeo' | 'bunny';
  addonSuggestionTickets?: number;
}

export interface FazendinhaHomeMediaSettings {
  enabled: boolean;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'gif' | 'youtube' | 'vimeo' | 'bunny';
  posterUrl?: string;
  title: string;
  description: string;
  fitMode: 'auto' | 'contain' | 'cover';
  alt: string;
  altText?: string;
  linkUrl?: string;
  linkTarget?: '_self' | '_blank';
  position: 'above-fazendinha';
}

export type FazendinhaMediaSlotSettings = Omit<FazendinhaHomeMediaSettings, 'position'> & {
  position?: 'above-fazendinha' | 'home-banner' | 'checkout';
};

export interface FazendinhaMediaSettings {
  homeBanner: FazendinhaMediaSlotSettings & { position: 'home-banner' };
  checkoutMedia: FazendinhaMediaSlotSettings & { position: 'checkout' };
  premiumExperience?: FazendinhaPremiumExperienceSettings;
}

export interface FazendinhaPremiumExperienceSettings {
  premiumInfoEnabled: boolean;
  premiumTitle: string;
  premiumDescription: string;
  premiumHighlight: string;
  caixinhaHighlightEnabled: boolean;
  caixinhaTitle: string;
  caixinhaDescription: string;
  caixinhaPrizeValue: string;
  caixinhaIcon: string;
  extractionEnabled: boolean;
  extractionTime: string;
  extractionText: string;
  prizeLabel: string;
  prizeValue: string;
  ticketPriceLabel: string;
  ticketPriceValue: string;
  ctaLabel: string;
  ctaSubtitle: string;
}

export interface FazendinhaGroup {
  id: string;
  nomeBicho: string;
  numeros: string[];
  imagemUrl?: string;
  status: FazendinhaGroupStatus;
  preco: number;
  compradorId?: string;
  compraId?: string;
}

export interface FazendinhaPurchase {
  id: string;
  usuarioId: string;
  grupoId: string;
  grupoIds?: string[];
  nomeBicho: string;
  nomeBichos?: string[];
  numeros: string[];
  valorPago: number;
  statusPagamento: 'reserved' | 'paid' | 'cancelled';
  dataCompra: string;
  reservedUntil?: string;
  pixExpiresAt?: string;
  customer: Customer;
  earnedLootboxes?: number;
  linkedPurchases?: Purchase[];
}

export interface FazendinhaWinner {
  id: string;
  usuarioId?: string;
  grupoId?: string;
  nomeBicho?: string;
  numeroSorteado: string;
  premio: string;
  data: string;
  semGanhador?: boolean;
}

export interface FazendinhaState {
  config: FazendinhaConfig;
  homeMedia?: FazendinhaHomeMediaSettings;
  mediaSettings?: FazendinhaMediaSettings;
  groups: FazendinhaGroup[];
  purchases: FazendinhaPurchase[];
  winners: FazendinhaWinner[];
  results?: Array<{ id: string; numeroSorteado: string; origemResultado: string; dataResultado: string }>;
}

export type NumberModeId = 'dezena' | 'centena' | 'milhar';
export type GameRoundStatus = 'active' | 'paused' | 'closed';

export interface NumberModeConfig {
  id: NumberModeId;
  enabled: boolean;
  name: string;
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'youtube' | 'vimeo' | 'bunny';
  digits: number;
  price: number;
  prize: string;
  drawDate: string;
  resultNumber: string;
  status: GameRoundStatus;
  reservationMinutes?: number;
  lootboxEnabled: boolean;
  lootboxConfig?: LootboxConfig;
}

export interface NumberModePurchase {
  id: string;
  mode: NumberModeId;
  numbers: string[];
  amount: number;
  status: 'reserved' | 'paid' | 'cancelled';
  createdAt: string;
  reservedUntil?: string;
  pixExpiresAt?: string;
  customer: Customer;
  earnedLootboxes?: number;
}

export interface NumberModeWinner {
  id: string;
  mode: NumberModeId;
  number: string;
  prize: string;
  origemResultado?: string;
  customer?: Customer;
  purchaseId?: string;
  createdAt: string;
  semGanhador?: boolean;
}

export interface NumberModeState {
  config: NumberModeConfig;
  numbers: Array<{ number: string; status: 'available' | 'sold' }>;
  purchases: NumberModePurchase[];
  ranking: Array<{ name: string; phone: string; tickets: number; amount: number }>;
  winners: NumberModeWinner[];
  history: NumberModePurchase[];
}

export interface ModalidadesState {
  rifas: any;
  fazendinha: FazendinhaConfig & { id: 'fazendinha'; mediaUrl: string; mediaType: 'image' | 'video' | 'youtube' | 'vimeo' | 'bunny'; ranking: any[] };
  numberModes: Array<NumberModeConfig & { ranking: any[] }>;
}

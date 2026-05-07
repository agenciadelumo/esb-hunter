export const qualificationStatusValues = ["none", "green", "yellow", "orange", "red"] as const;
export const catalogChannelValues = ["", "whatsapp", "email"] as const;
export const followUpChannelValues = ["", "ligacao", "whatsapp", "obra", "reforma"] as const;

export type QualificationStatus = (typeof qualificationStatusValues)[number];
export type CatalogChannel = (typeof catalogChannelValues)[number];
export type FollowUpChannel = (typeof followUpChannelValues)[number];

export type CrmRecord = {
  leadId: string;
  status: QualificationStatus;
  notes: string;
  attemptSummary: string;
  catalogChannel: CatalogChannel;
  followUpDate: string;
  followUpChannel: FollowUpChannel;
  followUpReason: string;
  serviceProviderName: string;
  serviceProviderContact: string;
  serviceProviderBuyer: string;
  serviceProviderBuyerContact: string;
  updatedAt: string;
  updatedBy: string;
};

export enum OpenAIModel {
  DAVINCI_TURBO = "gpt-3.5-turbo",
}

export type WBWPost = {
  title: string;
  url: string;
  date: string;
  type: "post" | "mini";
  content: string;
  length: number;
  tokens: number;
  chunks: WBWChunk[];
};

export type WBWChunk = {
  post_title: string;
  post_url: string;
  post_date: string | undefined;
  post_type: "post" | "mini";
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: number[];
};

export type WBWJSON = {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  posts: WBWPost[];
};

export type LNURLPAYDATA = {
  status: string;
  tag: string;
  commentAllowed: number;
  callback: string;
  metadata: string;
  minSendable: number;
  maxSendable: number;
  payerData: {
    name: { mandatory: boolean };
    email: { mandatory: boolean };
  };
  nostrPubkey: string;
  allowsNostr: boolean;
};

export type LightningInvoice = {
  status: string;
  successAction: {
    tag: string;
    message: string;
  };
  verify: string;
  routes: any[]; // You can replace this with a more specific type if needed
  pr: string;
};

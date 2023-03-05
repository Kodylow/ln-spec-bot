import { Answer } from "@/components/Answer/Answer";
import { Footer } from "@/components/Footer";
import { LightningModal } from "@/components/LightningModal";
import { Navbar } from "@/components/Navbar";
import { LightningInvoice, LNURLPAYDATA, WBWChunk } from "@/types";
import { getImage } from "@/utils/images";
import { IconBolt, IconExternalLink, IconSearch } from "@tabler/icons-react";
import endent from "endent";
import Head from "next/head";
import Image from "next/image";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

const apiKey = process.env.OPENAI_API_KEY || "";
const lnAddress = "kodylow@getalby.com";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState<string>("");
  const [chunks, setChunks] = useState<WBWChunk[]>([]);
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const [mode, setMode] = useState<"search" | "chat">("chat");
  const [matchCount, setMatchCount] = useState<number>(5);

  const [lnUrlPayData, setLnUrlPayData] = useState<LNURLPAYDATA>();
  const [invoice, setInvoice] = useState<LightningInvoice>();

  useEffect(() => {
    async function fetchLnUrlPayData() {
      const [username, host] = lnAddress.split("@");
      const url = `https://${host}/.well-known/lnurlp/${username}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);
      setLnUrlPayData(data);
    }

    fetchLnUrlPayData();
  }, []);

  const handleSearch = async () => {
    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, apiKey, matches: matchCount }),
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results: WBWChunk[] = await searchResponse.json();

    setChunks(results);

    setLoading(false);

    return results;
  };

  const handleAnswer = async () => {
    if (!apiKey) {
      alert("Please enter an API key.");
      return;
    }

    if (!query) {
      alert("Please enter a query.");
      return;
    }

    setAnswer("");
    setChunks([]);

    setLoading(true);

    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, apiKey, matches: matchCount }),
    });

    if (!searchResponse.ok) {
      setLoading(false);
      throw new Error(searchResponse.statusText);
    }

    const results: WBWChunk[] = await searchResponse.json();

    setChunks(results);

    const prompt = endent`
    Use the following passages to provide an answer to the query: "${query}"

    ${results?.map((d: any) => d.content).join("\n\n")}
    `;

    const answerResponse = await fetch("/api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, apiKey }),
    });

    if (!answerResponse.ok) {
      setLoading(false);
      throw new Error(answerResponse.statusText);
    }

    const data = answerResponse.body;

    if (!data) {
      return;
    }

    setLoading(false);

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setAnswer((prev) => prev + chunkValue);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (mode === "search") {
        handleSearch();
      } else {
        handleAnswer();
      }
    }
  };

  useEffect(() => {
    if (matchCount > 10) {
      setMatchCount(10);
    } else if (matchCount < 1) {
      setMatchCount(1);
    }
  }, [matchCount]);

  useEffect(() => {
    const WBW_MATCH_COUNT = localStorage.getItem("WBW_MATCH_COUNT");
    const WBW_MODE = localStorage.getItem("WBW_MODE");

    if (WBW_MATCH_COUNT) {
      setMatchCount(parseInt(WBW_MATCH_COUNT));
    }

    if (WBW_MODE) {
      setMode(WBW_MODE as "search" | "chat");
    }
  }, []);

  return (
    <>
      {showModal && invoice && (
        <LightningModal
          lightningInvoice={invoice}
          setShowModal={setShowModal}
        />
      )}
      <Head>
        <title>WRECK: The Reckless Lightning Specification Bot</title>
        <meta
          name="description"
          content={`AI-powered search and chat for Tim Urban's blog "Wait But Why."`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/boltsPic.ico" />
      </Head>

      <div className="flex flex-col h-screen">
        <Navbar />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex h-full w-full max-w-[750px] flex-col items-center px-3 pt-4 sm:pt-8">
            <div className="relative w-full mt-4 border border-gray-400 rounded-full flex items-center justify-between">
              <IconSearch className="absolute top-3 w-10 left-1 h-6 rounded-full opacity-50 sm:left-3 sm:top-4 sm:h-8" />
              <div className="flex-grow">
                <input
                  ref={inputRef}
                  className="h-12 w-full rounded-full border-none px-11 focus:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-800 sm:h-16 sm:py-2 sm:pr-16 sm:pl-16 sm:text-lg"
                  type="text"
                  placeholder="What is a BOLT11 lightning invoice and how do I parse it?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <IconBolt
                onClick={async () => {
                  const response = await fetch(
                    `${lnUrlPayData?.callback}?amount=1000000`
                  );
                  const invoice: LightningInvoice = await response.json();
                  setInvoice(invoice);
                  setShowModal(true);
                }}
                className="absolute top-3 right-1 h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center cursor-pointer sm:right-3 sm:top-4 sm:h-8 sm:w-8 hover:filter hover:invert"
              />
            </div>

            {loading ? (
              <div className="mt-6 w-full">
                {mode === "chat" && (
                  <>
                    <div className="font-bold text-2xl">Answer</div>
                    <div className="animate-pulse mt-2">
                      <div className="h-4 bg-gray-300 rounded"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                      <div className="h-4 bg-gray-300 rounded mt-2"></div>
                    </div>
                  </>
                )}

                <div className="font-bold text-2xl mt-6">Passages</div>
                <div className="animate-pulse mt-2">
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                  <div className="h-4 bg-gray-300 rounded mt-2"></div>
                </div>
              </div>
            ) : answer ? (
              <div className="mt-6">
                <div className="font-bold text-2xl mb-2">Answer</div>
                <Answer text={answer} />

                <div className="mt-6 mb-16">
                  <div className="font-bold text-2xl">Passages</div>

                  {chunks.map((chunk, index) => (
                    <div key={index}>
                      <div className="mt-4 border border-zinc-600 rounded-lg p-4">
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Image
                              className="rounded-lg"
                              src={getImage(chunk.post_title)}
                              width={103}
                              height={70}
                              alt={chunk.post_title}
                            />
                            <div className="ml-4">
                              <div className="font-bold text-xl">
                                {chunk.post_title}
                              </div>
                              <div className="mt-1 font-bold text-sm">
                                {chunk.post_date}
                              </div>
                            </div>
                          </div>
                          <a
                            className="hover:opacity-50 ml-4"
                            href={chunk.post_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <IconExternalLink />
                          </a>
                        </div>
                        <div className="mt-4">{chunk.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : chunks.length > 0 ? (
              <div className="mt-6 pb-16">
                <div className="font-bold text-2xl">Passages</div>
                {chunks.map((chunk, index) => (
                  <div key={index}>
                    <div className="mt-4 border border-zinc-600 rounded-lg p-4">
                      <div className="flex justify-between">
                        <div className="flex items-center">
                          <Image
                            className="rounded-lg"
                            src={getImage(chunk.post_title)}
                            width={103}
                            height={70}
                            alt={chunk.post_title}
                          />
                          <div className="ml-4">
                            <div className="font-bold text-xl">
                              {chunk.post_title}
                            </div>
                            <div className="mt-1 font-bold text-sm">
                              {chunk.post_date}
                            </div>
                          </div>
                        </div>
                        <a
                          className="hover:opacity-50 ml-2"
                          href={chunk.post_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <IconExternalLink />
                        </a>
                      </div>
                      <div className="mt-4">{chunk.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 text-center text-lg">{`AI-powered search and chat for all things Lightning: the specification, implementations, and how to get started building with it`}</div>
            )}
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

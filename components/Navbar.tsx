import { IconExternalLink } from "@tabler/icons-react";
import Image from "next/image";
import { FC } from "react";
import boltsPic from "../public/boltsPic.png";

export const Navbar: FC = () => {
  return (
    <div className="flex h-[60px] border-b border-gray-300 py-2 px-8 items-center rounded-md justify-between">
      <div className="font-bold text-2xl flex items-center">
        <Image
          className="hidden sm:flex rounded-md"
          src={boltsPic}
          alt="The Lightning BOLTS"
          width={45}
          height={45}
        />
        <div className="ml-2">
          WRECK: The Reckless Lightning Specification Bot
        </div>
      </div>
      <div>
        <a
          className="flex items-center hover:opacity-50"
          href="https://github.com/lightning/bolts"
          target="_blank"
          rel="noreferrer"
        >
          BOLTS Repo
          <IconExternalLink className="ml-1" size={20} />
        </a>
      </div>
    </div>
  );
};

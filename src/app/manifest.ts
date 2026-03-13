import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DOOM INDEX",
    short_name: "DOOM INDEX",
    description:
      "A decentralized archive of financial emotions. AI generates one painting every hour, translating the collective psychology of trending tokens into visual art.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "en",
    icons: [
      {
        src: "/icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}

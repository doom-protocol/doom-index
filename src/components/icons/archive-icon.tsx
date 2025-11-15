import type { SVGProps } from "react";

export const ArchiveIcon = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13a9 9 0 1 0 2.1-8.6L8 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
};

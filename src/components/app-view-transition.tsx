"use client";

import * as React from "react";
import { Fragment } from "react";
import type { FC, ReactNode } from "react";

type ReactWithViewTransition = typeof React & {
  ViewTransition?: FC<{ children: ReactNode }>;
};

const ResolvedViewTransition = (React as ReactWithViewTransition).ViewTransition ?? Fragment;

export const AppViewTransition: FC<{ children: ReactNode }> = ({ children }) => {
  return <ResolvedViewTransition>{children}</ResolvedViewTransition>;
};

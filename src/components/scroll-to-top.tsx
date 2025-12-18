"use client";

import * as React from "react";

export function ScrollToTop() {
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return null;
}

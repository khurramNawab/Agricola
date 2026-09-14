import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component:
 * Listens for React Router pathname and search query changes.
 * Whenever navigation occurs (e.g. clicking links in the footer, header, or product cards),
 * it scrolls the window back to (0, 0) instantly so the new page always starts at the top.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname, search]);

  return null;
}

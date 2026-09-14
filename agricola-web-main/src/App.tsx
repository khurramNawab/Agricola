import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "./components/layout/Header";
import ScrollToTop from "./components/common/ScrollToTop";

const App = () => {
  // Prevent mouse wheel from rapidly changing number values in input[type=number] across the entire app
  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === "number") {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <>
      <ScrollToTop />
      <Header />
      <Outlet />
    </>
  );
};

export default App;

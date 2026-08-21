import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Forecast from "./pages/Forecast";
import Compare from "./pages/Compare";
import MapView from "./pages/MapView";
import About from "./pages/About";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/county/:countyName" element={<Dashboard />} />
        <Route path="/county/:countyName/forecast" element={<Forecast />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/about" element={<About />} />
      </Route>
    </Routes>
  );
}

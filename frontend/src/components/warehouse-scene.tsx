"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Line, OrbitControls } from "@react-three/drei";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import type { Inventory } from "@/lib/models";
import * as THREE from "three";
function Box({
  position,
  size,
  color = "#29475b",
  onClick,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={position}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={onClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={hover ? "#38bdf8" : color}
        metalness={0.45}
        roughness={0.45}
      />
    </mesh>
  );
}
function Vehicle({ animate }: { animate: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current && animate)
      ref.current.position.x = Math.sin(clock.elapsedTime * 0.4) * 3;
  });
  return (
    <group ref={ref} position={[0, 0.22, 2.5]}>
      <Box position={[0, 0, 0]} size={[0.8, 0.35, 0.4]} color="#38bdf8" />
      <Box position={[0.32, 0.2, 0]} size={[0.25, 0.2, 0.4]} color="#b4e5f9" />
    </group>
  );
}
function Scene({
  animate,
  select,
  zone,
  racks,
}: {
  animate: boolean;
  select: (zone: string) => void;
  zone: string;
  racks: RackSummary[];
}) {
  const { camera } = useThree();
  const scrollDepth = useRef(0);
  useEffect(() => {
    const update = () => {
      scrollDepth.current = Math.min(window.scrollY / 800, 1);
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const target = useRef(new THREE.Vector3(9, 8, 10));
  useEffect(() => {
    const positions: Record<string, [number, number, number]> = {
      Overview: [9, 8, 10],
      Receiving: [-8, 6, 8],
      Storage: [1, 9, 9],
      Dispatch: [9, 5, 5],
    };
    target.current.set(...positions[zone]);
    if (!animate) {
      camera.position.copy(target.current);
      camera.lookAt(0, 0, 0);
    }
  }, [zone, animate, camera]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    if (animate) camera.position.lerp(target.current, 0.025);
    if (group.current && animate) {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        scrollDepth.current * 0.07,
        0.025,
      );
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        pointer.x * 0.08,
        0.025,
      );
    }
  });
  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 8, 3]} intensity={3} castShadow />
      <pointLight position={[-4, 3, -2]} intensity={30} color="#38bdf8" />
      <group ref={group}>
        <Box position={[0, -0.18, 0]} size={[10, 0.3, 7]} color="#142636" />
        <gridHelper
          args={[10, 20, "#2a5367", "#1b3548"]}
          position={[0, -0.015, 0]}
        />
        <Box position={[0, 0.08, 0]} size={[6.7, 0.18, 3.8]} color="#34495a" />
        {[-2.4, 0, 2.4].map((x, i) => (
          <group
            key={x}
            onClick={() => select(["Receiving", "Storage", "Dispatch"][i])}
          >
            {[-0.9, 0.2, 1.3].map((z) => (
              <group key={z}>
                {[0.5, 1.2].map((y) => (
                  <group key={y}>
                    <Box
                      position={[x, y, z]}
                      size={[1.8, 0.08, 0.65]}
                      color="#65b9d3"
                    />
                    {[-0.55, 0, 0.55].map((p, j) => (
                      <Box
                        key={p}
                        position={[x + p, y + 0.22, z]}
                        size={[0.45, 0.4, 0.5]}
                        color={j === 1 ? "#b8824f" : "#6e8e9d"}
                      />
                    ))}
                  </group>
                ))}
                {[-0.9, 0.9].map((p) => (
                  <Box
                    key={p}
                    position={[x + p, 0.8, z]}
                    size={[0.06, 1.8, 0.7]}
                    color="#34708a"
                  />
                ))}
              </group>
            ))}
            <Box
              position={[x, 2, -0.0]}
              size={[2.1, 0.12, 3.8]}
              color={
                racks[i].items === 0
                  ? "#213e53"
                  : racks[i].out === racks[i].items
                    ? "#a33d54"
                    : racks[i].low > 0
                      ? "#96703c"
                      : "#236078"
              }
            />
          </group>
        ))}
        <Line
          points={[
            [-4, 0.03, 2.5],
            [4, 0.03, 2.5],
            [4, 0.03, -2.5],
            [-4, 0.03, -2.5],
            [-4, 0.03, 2.5],
          ]}
          color="#38bdf8"
          lineWidth={1.5}
        />
        <Vehicle animate={animate} />
        {[-3.5, -2.5, -1.5].map((x) => (
          <Box
            key={x}
            position={[x, 0.22, -2.5]}
            size={[0.65, 0.4, 0.7]}
            color="#2563eb"
          />
        ))}
      </group>
      <ContactShadows
        position={[0, -0.4, 0]}
        opacity={0.5}
        scale={16}
        blur={2}
        far={8}
      />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.5}
        maxPolarAngle={1.3}
        autoRotate={false}
      />
    </>
  );
}
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? <Fallback /> : this.props.children;
  }
}
function Fallback() {
  return (
    <div className="scene-fallback">
      <div>
        ▰ ▰ ▰<br />▰ ▰ ▰<br />▰ ▰ ▰
      </div>
      <p>Warehouse overview · lightweight view</p>
    </div>
  );
}
interface RackSummary {
  items: number;
  units: number;
  low: number;
  out: number;
  locations: string[];
}
export default function WarehouseScene({
  inventory,
}: {
  inventory: Inventory[];
}) {
  const [city, setCity] = useState("All");
  const visibleInventory = inventory.filter(
    (item) => city === "All" || item.location.startsWith(city + "-"),
  );
  const locations = [
    ...new Set(visibleInventory.map((item) => item.location)),
  ].sort();
  const racks: RackSummary[] = [0, 1, 2].map((index) => {
    const assigned = locations.filter((_, i) => i % 3 === index);
    const items = visibleInventory.filter((item) =>
      assigned.includes(item.location),
    );
    return {
      items: items.length,
      units: items.reduce((sum, item) => sum + item.quantity, 0),
      low: items.filter((item) => item.quantity <= 10).length,
      out: items.filter((item) => item.quantity === 0).length,
      locations: assigned,
    };
  });
  const [ready, setReady] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [zone, setZone] = useState("Overview");
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    const sync = () =>
      setAnimate(
        visible &&
          !document.hidden &&
          !mq.matches &&
          localStorage.getItem("logitrack-motion") !== "reduced",
      );
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      sync();
    });
    if (holder.current) observer.observe(holder.current);
    document.addEventListener("visibilitychange", sync);
    mq.addEventListener("change", sync);
    const canvas = document.createElement("canvas");
    queueMicrotask(() => {
      setReady(Boolean(canvas.getContext("webgl2")));
      sync();
    });
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      mq.removeEventListener("change", sync);
    };
  }, []);
  return (
    <div className="warehouse" ref={holder}>
      <div className="scene-label">
        <span className="status-dot" /> DIGITAL WAREHOUSE{" "}
        <span> / {zone.toUpperCase()}</span>
      </div>
      <div className="scene-data">
        <label>
          Inventory scope{" "}
          <select
            aria-label="Warehouse inventory scope"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          >
            {[
              ["All", "All locations"],
              ["LHR", "Lahore"],
              ["KHI", "Karachi"],
              ["ISB", "Islamabad"],
              ["MUX", "Multan"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p aria-live="polite">
          {zone === "Overview"
            ? `${visibleInventory.length} products · ${visibleInventory.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()} units · ${visibleInventory.filter((item) => item.quantity <= 10).length} low / empty`
            : (() => {
                const rack =
                  racks[["Receiving", "Storage", "Dispatch"].indexOf(zone)];
                return `${rack.items} products · ${rack.units.toLocaleString()} units · ${rack.low} low / empty`;
              })()}
        </p>
        {zone !== "Overview" && (
          <details>
            <summary>View represented locations</summary>
            <span>
              {racks[
                ["Receiving", "Storage", "Dispatch"].indexOf(zone)
              ].locations.join(", ") || "No inventory in this scope"}
            </span>
          </details>
        )}
      </div>
      <Boundary>
        {ready ? (
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [9, 8, 10], fov: 40 }}
            frameloop={animate ? "always" : "demand"}
          >
            <Scene
              animate={animate}
              select={setZone}
              zone={zone}
              racks={racks}
            />
          </Canvas>
        ) : (
          <Fallback />
        )}
      </Boundary>
      <div className="scene-controls">
        {["Overview", "Receiving", "Storage", "Dispatch"].map((z) => (
          <button
            key={z}
            className={zone === z ? "selected" : ""}
            onClick={() => setZone(z)}
          >
            {z}
          </button>
        ))}
      </div>
      <small className="scene-footnote">
        CONCEPTUAL AGGREGATION · Amber: low stock · Rose: empty · Drag to orbit
      </small>
    </div>
  );
}

import { PresentationControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Mesh } from "three";

export function LogoScene() {
  return (
    <Canvas
      className="cursor-[none!important]"
      camera={{ position: [0, 0, 6], fov: 18, near: 1, far: 25 }}
    >
      <Suspense>
        <Logo />
      </Suspense>
    </Canvas>
  );
}

function Logo() {
  const { nodes } = useGLTF("/3d/logo-transformed.glb");
  const ref = useRef<Mesh>(null!);
  useFrame((state, delta) => {
    ref.current.rotation.z += delta * 0.5;
    ref.current.rotation.x += delta * 0.5;
    ref.current.position.y = Math.sin(state.clock.getElapsedTime()) * 0.2;
  });

  return (
    <PresentationControls
      global
      snap={0.1}
      damping={0.2}
      polar={[-Math.PI / 3, Math.PI / 3]}
      azimuth={[-Math.PI / 1.4, Math.PI / 2]}
    >
      <group rotation={[Math.PI / 2, 0, 0]} scale={1.2}>
        <mesh ref={ref} geometry={(nodes.logo as any).geometry}>
          <meshBasicMaterial color="black" />
        </mesh>
      </group>
    </PresentationControls>
  );
}

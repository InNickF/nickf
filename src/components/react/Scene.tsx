import { modifyHSL } from "@/utils";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  useTexture,
} from "@react-three/drei";
import {
  Canvas,
  useFrame,
  type CanvasProps,
  type Vector3 as TVector3,
} from "@react-three/fiber";
import {
  ChromaticAberration,
  EffectComposer,
  N8AO,
  Noise,
} from "@react-three/postprocessing";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RapierCollider,
  RapierRigidBody,
  RigidBody,
} from "@react-three/rapier";
import { easing } from "maath";
import { useCallback, useMemo, useRef, useState } from "react";
import { MathUtils, Mesh, Vector3 } from "three";
import useThemeEvent from "./hooks/useThemeEvent";

const shuffle = () => {
  const themeContext = document.querySelector(
    '[data-theme-context="nick"]',
  ) as HTMLDivElement;

  const activeTheme = Number(themeContext?.getAttribute("data-theme")) || 0;

  const isFirstTheme = activeTheme === 0;
  const themeStyles = getComputedStyle(themeContext);
  const getThemeColor = themeStyles.getPropertyValue("--color-primary");
  const newColor = modifyHSL(getThemeColor, {
    s: (s) => (isFirstTheme ? s + 2 : s - 0.2),
    l: (l) => (isFirstTheme ? l + 15 : l - 20),
  });

  return [
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#fff", isSquared: isFirstTheme },
    { color: "#fff", isSquared: isFirstTheme },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
  ];
};

export function Scene({ className, ...props }: CanvasProps) {
  const [rerender, setRerender] = useState(0);
  const makeRerender = useCallback(() => {
    setRerender((prev) => prev + 1);
  }, []);

  useThemeEvent(makeRerender);
  const getClasses = () => {
    return `react-scene ${className}`;
  };

  const connectors = useMemo(() => shuffle(), [rerender]);

  return (
    <Canvas
      gl={{
        alpha: true,
        antialias: true,
      }}
      className={getClasses()}
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [20, 1, 15], fov: 18, near: 1, far: 50 }}
      {...props}
    >
      <ambientLight intensity={3} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
      />
      <Controls />
      <Physics gravity={[0, 0, 0]}>
        <Pointer />
        {connectors.map((props, i) => (
          <PhysicsElement key={i} {...props} />
        ))}
        <PhysicsElement
          position={[-10, -10, 10]}
          isSquared={connectors[0].isSquared}
        >
          <SecondModel isSquared={connectors[0].isSquared} />
        </PhysicsElement>
        <PhysicsElement
          position={[10, 10, 10]}
          isSquared={connectors[0].isSquared}
        >
          <SecondModel isSquared={connectors[0].isSquared} />
        </PhysicsElement>
      </Physics>
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer
            form="circle"
            intensity={4}
            rotation-x={Math.PI / 2}
            position={[0, 5, -9]}
            scale={4}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, 1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={Math.PI / 2}
            position={[-5, -1, -1]}
            scale={2}
          />
          <Lightformer
            form="circle"
            intensity={2}
            rotation-y={-Math.PI / 2}
            position={[10, 1, 0]}
            scale={8}
          />
        </group>
      </Environment>
      <EffectComposer multisampling={14}>
        <N8AO distanceFalloff={10} aoRadius={10} intensity={8} />
        <ChromaticAberration offset={[0.001, 0.001]} />
        <Noise premultiply />
      </EffectComposer>
    </Canvas>
  );
}

function Controls() {
  useFrame((state, delta) => {
    const y = state.pointer.y * 10 > 4 ? 4 : state.pointer.y * 10;
    easing.damp3(
      state.camera.position,
      [Math.sin(state.pointer.x) * 15, state.pointer.y * 15, 15],
      0.5,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function PhysicsElement({
  position,
  children,
  vec = new Vector3(),
  scale,
  r = MathUtils.randFloatSpread,
  ...props
}: {
  position?: TVector3;
  children?: React.ReactNode;
  vec?: Vector3;
  scale?: number;
  r?: (value: number) => number;
  color?: string;
  isSquared: boolean;
} & React.ComponentProps<typeof RigidBody>) {
  const api = useRef<RapierRigidBody>(null!);
  const pos = useMemo(() => position || [r(12), r(12), r(12)], []) as Vector3;
  useFrame((state, delta) => {
    delta = Math.min(0.1, delta);
    api.current?.applyImpulse(
      vec.copy(api.current.translation()).negate().multiplyScalar(0.01),
      true,
    );
  });
  return (
    <RigidBody
      linearDamping={20}
      angularDamping={1}
      friction={1}
      position={pos}
      ref={api}
      colliders={false}
    >
      {props.isSquared ? (
        <CuboidCollider args={[0.22, 0.22, 0.22]} />
      ) : (
        <BallCollider args={[0.3]} />
      )}

      {children ? children : <Model {...props} />}
    </RigidBody>
  );
}

function Pointer({ vec = new Vector3() }) {
  const ref = useRef<RapierRigidBody>(null!);
  const colliderRef = useRef<RapierCollider>(null!);
  useThemeEvent(() => {
    ref.current?.setNextKinematicTranslation(vec.set(0, 0, 0));
    colliderRef.current?.setRadius(2);
    setTimeout(() => {
      colliderRef.current?.setRadius(0.4);
    }, 150);
  });
  useFrame(({ viewport, pointer }) => {
    ref.current?.setNextKinematicTranslation(
      vec.set(
        (pointer.x * viewport.width) / 2,
        (pointer.y * viewport.height) / 2,
        0,
      ),
    );
  });
  return (
    <RigidBody
      position={[10, 10, 0]}
      type="kinematicPosition"
      colliders={false}
      ref={ref}
    >
      <BallCollider ref={colliderRef} args={[0.2]} />
    </RigidBody>
  );
}

function Model({
  children,
  color = "white",
  metalness = 0.4,
  roughness = 1,
  ...props
}: {
  children?: React.ReactNode;
  color?: string;
  isSquared: boolean;
  metalness?: number;
  roughness?: number;
} & React.ComponentProps<typeof RigidBody>) {
  const ref = useRef<Mesh>(null!);
  useFrame((state, delta) => {
    easing.dampC((ref.current.material as any).color, color, 0.2, delta);
  });
  const displacement = useTexture("/displacement.jpg");
  return (
    <mesh ref={ref} castShadow receiveShadow>
      {props.isSquared ? (
        <boxGeometry args={[0.45, 0.45, 0.45]} />
      ) : (
        <sphereGeometry args={[0.3]} />
      )}
      <meshStandardMaterial
        metalness={metalness}
        roughness={roughness}
        map={displacement}
      />
      {children}
    </mesh>
  );
}

function SecondModel({
  children,
  isSquared = false,
}: {
  children?: React.ReactNode;
  isSquared?: boolean;
}) {
  const ref = useRef<Mesh>(null!);
  const displacement = useTexture("/displacement.jpg");
  return (
    <Model isSquared={isSquared}>
      <MeshTransmissionMaterial
        clearcoat={5}
        thickness={0.4}
        anisotropicBlur={0.5}
        chromaticAberration={0.5}
        samples={12}
        resolution={512}
        map={displacement}
      />
    </Model>
  );
}

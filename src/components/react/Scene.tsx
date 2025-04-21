import { modifyHSL } from "@/utils";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  PerformanceMonitor,
  useTexture,
} from "@react-three/drei";
import {
  Canvas,
  useFrame,
  type CanvasProps,
  type Vector3 as TVector3,
} from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RapierCollider,
  RapierRigidBody,
  RigidBody,
} from "@react-three/rapier";
import { easing } from "maath";
import { useMemo, useRef, useState } from "react";
import { MathUtils, Mesh, Vector3 } from "three";
import useThemeEvent from "./hooks/useThemeEvent";
import { getDocumentStyles } from "./utils";
interface ShuffleParams {
  color?: string;
  activeTheme?: number;
  currentHue?: string;
}

const shuffle = ({
  activeTheme = 0,
  color = "hsl(350, 23%, 40%)",
  currentHue = "350",
}: ShuffleParams) => {
  const isFirstTheme = activeTheme === 0;
  const newColor = modifyHSL(
    color,
    {
      s: (s) => (isFirstTheme ? s + 2 : s - 0.2),
      l: (l) => (isFirstTheme ? l + 15 : l - 20),
    },
    currentHue,
  );

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
  const [perfSucks, degrade] = useState(true);
  const [connectors, setConnectors] = useState(shuffle({}));
  useThemeEvent(() => {
    const { activeTheme, color, currentHue } = getDocumentStyles();
    const newConnectors = shuffle({ activeTheme, color, currentHue });
    setConnectors(newConnectors);
  });
  const getClasses = () => {
    return `react-scene ${className}`;
  };

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
      <PerformanceMonitor
        onDecline={() => degrade(true)}
        onIncline={() => degrade(false)}
      />
      <Lights perfSucks={perfSucks} />
      <Controls />
      <Physics gravity={[0, 0, 0]}>
        <Pointer />
        {connectors.map((props, i) => {
          const hasToRender = perfSucks ? i % 2 === 0 : true;
          return hasToRender && <PhysicsElement key={i} {...props} />;
        })}
        <ExtraShapes
          perfSucks={perfSucks}
          isSquared={connectors[0]?.isSquared}
        />
      </Physics>

      <Envs perfSucks={perfSucks} />
      <Effects perfSucks={perfSucks} />
    </Canvas>
  );
}
interface EffectsProps {
  perfSucks?: boolean;
}
function Effects({ perfSucks }: EffectsProps) {
  return perfSucks ? null : (
    <EffectComposer multisampling={14}>
      <N8AO distanceFalloff={10} aoRadius={10} intensity={8} />
    </EffectComposer>
  );
}

function Envs({ perfSucks }: { perfSucks?: boolean }) {
  return perfSucks ? null : (
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

function ExtraShapes({
  perfSucks,
  isSquared,
}: {
  perfSucks?: boolean;
  isSquared: boolean;
}) {
  return (
    <>
      <PhysicsElement position={[-10, -10, 10]} isSquared={isSquared}>
        <SecondModel isSquared={isSquared} />
      </PhysicsElement>
      {perfSucks ? null : (
        <PhysicsElement position={[10, 10, 10]} isSquared={isSquared}>
          <SecondModel isSquared={isSquared} />
        </PhysicsElement>
      )}
    </>
  );
}

function Lights({ perfSucks }: { perfSucks?: boolean }) {
  return perfSucks ? null : (
    <>
      <ambientLight intensity={3} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
      />
    </>
  );
}

function PhysicsElement({
  position,
  children,
  vec = new Vector3(),
  scale,
  r = MathUtils.randFloatSpread,
  perfSucks,
  ...props
}: {
  position?: TVector3;
  children?: React.ReactNode;
  vec?: Vector3;
  scale?: number;
  r?: (value: number) => number;
  color?: string;
  isSquared: boolean;
  perfSucks?: boolean;
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
  perfSucks,
  ...props
}: {
  children?: React.ReactNode;
  color?: string;
  isSquared: boolean;
  metalness?: number;
  roughness?: number;
  perfSucks?: boolean;
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
      {perfSucks ? null : <meshBasicMaterial map={displacement} />}
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

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, type BufferGeometry } from "three";

// Mock GLTFExporter and GLTFLoader
const mockParseExporter = mock(
  (
    _input: unknown,
    _onCompleted: (result: ArrayBuffer | object) => void,
    _onError: (error: unknown) => void,
    _options: { binary?: boolean },
  ) => {
    // Default implementation
  },
);

const mockParseLoader = mock(
  (
    _data: ArrayBuffer,
    _path: string,
    _onLoad: (gltf: { scene: Group }) => void,
    _onError: (error: unknown) => void,
  ) => {
    // Default implementation
  },
);

const mockSimplifyModifier = mock((_geometry: BufferGeometry, _count: number) => {
  return _geometry; // Return same geometry for simplicity
});

// Set up module mock before any imports
mock.module("three-stdlib", () => ({
  GLTFExporter: class {
    parse = mockParseExporter;
  },
  GLTFLoader: class {
    parse = mockParseLoader;
  },
  SimplifyModifier: class {
    modify = mockSimplifyModifier;
  },
}));

// Override any existing mock for glb-export-service to ensure we test the real implementation
// This is necessary because other test files (e.g., gallery-page.integration.test.tsx) may mock this module
// We use import.meta.require (Bun's synchronous require) to get the actual module and re-export it
// This ensures the real implementation is used even if other tests have mocked it
mock.module("@/lib/glb-export-service", () => {
  // Use Bun's import.meta.require for synchronous module loading
  // @ts-expect-error - import.meta.require is a Bun-specific API
  const realModule = import.meta.require("@/lib/glb-export-service");
  return realModule;
});

// Import service after mocking - use static import to work with mock.module
// The mock.module() call above ensures we get the real implementation
import { glbExportService } from "@/lib/glb-export-service";

// Verify the service is properly loaded
if (!glbExportService || typeof glbExportService.exportPaintingModel !== "function") {
  throw new Error(
    `glbExportService is not properly loaded. Type: ${typeof glbExportService}, Keys: ${glbExportService ? Object.keys(glbExportService).join(", ") : "undefined"}`,
  );
}

describe("glbExportService", () => {
  beforeEach(() => {
    mockParseExporter.mockReset();
    mockParseLoader.mockReset();
    mockSimplifyModifier.mockReset();
  });

  describe("exportPaintingModel", () => {
    it("should export a valid GLB file from a FramedPainting-like Group", async () => {
      // Arrange
      const mockGroup = new Group();

      // Create a mock mesh (representing the painting plane)
      const mockGeometry = new PlaneGeometry(1, 1);
      const mockMaterial = new MeshStandardMaterial();
      const mockMesh = new Mesh(mockGeometry, mockMaterial);
      mockGroup.add(mockMesh);

      // Create a mock frame mesh
      const mockFrameGeometry = new PlaneGeometry(1.2, 1.2);
      const mockFrameMaterial = new MeshStandardMaterial();
      const mockFrameMesh = new Mesh(mockFrameGeometry, mockFrameMaterial);
      mockGroup.add(mockFrameMesh);

      const mockRef = { current: mockGroup };

      // Mock GLTFExporter.parse to return a GLB buffer
      const mockGlbBuffer = new ArrayBuffer(1024);
      mockParseExporter.mockImplementation((_input: unknown, onCompleted: (result: ArrayBuffer | object) => void) => {
        onCompleted(mockGlbBuffer);
      });

      // Act
      const result = await glbExportService.exportPaintingModel(mockRef);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const file = result.value;
        expect(file).toBeInstanceOf(File);
        expect(file.name).toContain("painting");
        expect(file.type).toBe("application/octet-stream");
        expect(file.size).toBe(mockGlbBuffer.byteLength);
      }
    });

    it("should return an error when the group ref is null", async () => {
      const mockRef = { current: null };
      const result = await glbExportService.exportPaintingModel(mockRef);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ValidationError");
        expect(result.error.message).toContain("Painting model reference is null");
      }
    });

    it("should return an error when the group has no meshes", async () => {
      const mockGroup = new Group();
      const mockRef = { current: mockGroup };
      const result = await glbExportService.exportPaintingModel(mockRef);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ValidationError");
        expect(result.error.message).toContain("No meshes found in painting model");
      }
    });

    it("should return an error when GLTFExporter.parse fails", async () => {
      const mockGroup = new Group();
      const mockGeometry = new PlaneGeometry(1, 1);
      const mockMaterial = new MeshStandardMaterial();
      const mockMesh = new Mesh(mockGeometry, mockMaterial);
      mockGroup.add(mockMesh);
      const mockRef = { current: mockGroup };

      mockParseExporter.mockImplementation(
        (_input: unknown, _onCompleted: (result: ArrayBuffer | object) => void, onError: (error: unknown) => void) => {
          onError(new Error("Export failed"));
        },
      );

      const result = await glbExportService.exportPaintingModel(mockRef);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
        expect(result.error.message).toContain("Export failed");
      }
    });
  });

  describe("optimizeGlb", () => {
    it("should optimize GLB buffer if it exceeds target size", async () => {
      // Arrange
      const largeBuffer = new ArrayBuffer(1024 * 1024 * 40); // 40MB
      const targetSizeMB = 32;
      const optimizedBuffer = new ArrayBuffer(1024 * 1024 * 20); // 20MB

      // Mock GLTFLoader to return a fake GLTF object with a mesh
      const mockScene = new Group();
      const mockGeometry = new PlaneGeometry(1, 1);
      // Mock attributes for SimplifyModifier check
      Object.defineProperty(mockGeometry, "attributes", {
        value: {
          position: { count: 2000 }, // > 1000 threshold
        },
        writable: true,
      });
      const mockMesh = new Mesh(mockGeometry, new MeshStandardMaterial());
      // Ensure isMesh property is set
      Object.defineProperty(mockMesh, "isMesh", { value: true, writable: true });
      mockScene.add(mockMesh);

      mockParseLoader.mockImplementation(
        (_data: ArrayBuffer, _path: string, onLoad: (gltf: { scene: Group }) => void) => {
          onLoad({ scene: mockScene });
        },
      );

      // Mock GLTFExporter to return the optimized buffer
      mockParseExporter.mockImplementation((_input: unknown, onCompleted: (result: ArrayBuffer | object) => void) => {
        onCompleted(optimizedBuffer);
      });

      // Act
      const result = await glbExportService.optimizeGlb(largeBuffer, targetSizeMB);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(optimizedBuffer);
      }
      expect(mockParseLoader).toHaveBeenCalled();
      expect(mockSimplifyModifier).toHaveBeenCalled();
      expect(mockParseExporter).toHaveBeenCalled();
    });

    it("should return original buffer if it is within target size", async () => {
      // Arrange
      const smallBuffer = new ArrayBuffer(1024 * 1024 * 10); // 10MB
      const targetSizeMB = 32;

      // Act
      const result = await glbExportService.optimizeGlb(smallBuffer, targetSizeMB);

      // Assert
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(smallBuffer);
      }
      expect(mockParseLoader).not.toHaveBeenCalled();
    });

    it("should handle loader errors during optimization", async () => {
      // Arrange
      const largeBuffer = new ArrayBuffer(1024 * 1024 * 40);
      const targetSizeMB = 32;

      mockParseLoader.mockImplementation(
        (
          _data: ArrayBuffer,
          _path: string,
          _onLoad: (gltf: { scene: Group }) => void,
          onError: (error: unknown) => void,
        ) => {
          onError(new Error("Load failed"));
        },
      );

      // Act
      const result = await glbExportService.optimizeGlb(largeBuffer, targetSizeMB);

      // Assert
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("InternalError");
        expect(result.error.message).toContain("Optimization failed");
        expect(result.error.message).toContain("Load failed");
      }
    });
  });
});

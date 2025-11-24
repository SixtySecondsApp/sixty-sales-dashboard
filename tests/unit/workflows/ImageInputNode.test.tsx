import { render, fireEvent, screen } from '@testing-library/react';
import type { NodeProps, Node } from 'reactflow';
import ImageInputNode, { type ImageInputNodeData } from '@/components/workflows/nodes/freepik/ImageInputNode';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetNodes = vi.fn();

vi.mock('reactflow', async () => {
  const actual = await vi.importActual<typeof import('reactflow')>('reactflow');
  return {
    ...actual,
    Handle: () => null,
    useReactFlow: () => ({
      setNodes: mockSetNodes
    })
  };
});

const createProps = (data: ImageInputNodeData = {}): NodeProps<ImageInputNodeData> =>
  ({
    id: 'image-node',
    data,
    selected: false
  } as unknown as NodeProps<ImageInputNodeData>);

describe('ImageInputNode', () => {
  beforeEach(() => {
    mockSetNodes.mockClear();
  });

  it('saves image URLs back into the React Flow node data', () => {
    render(<ImageInputNode {...createProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /url/i }));

    const testUrl = 'https://example.com/image.png';
    fireEvent.change(screen.getByPlaceholderText(/enter image url/i), { target: { value: testUrl } });
    fireEvent.submit(screen.getByTestId('image-url-form'));

    expect(mockSetNodes).toHaveBeenCalledTimes(1);

    const updater = mockSetNodes.mock.calls[0][0] as (nodes: Node<ImageInputNodeData>[]) => Node<ImageInputNodeData>[];
    const updatedNodes = updater([
      {
        id: 'image-node',
        type: 'imageInput',
        data: {},
        position: { x: 0, y: 0 }
      } as Node<ImageInputNodeData>
    ]);

    expect(updatedNodes[0].data.src).toBe(testUrl);
  });
});


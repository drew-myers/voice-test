import { Change } from "diff";

type DiffViewProps = {
  parts: Change[];
};

export const DiffView = ({ parts }: DiffViewProps) => (
  <div className="diff">
    {parts.map((part, index) => {
      const className = part.added
        ? "diff-line diff-line--added"
        : part.removed
          ? "diff-line diff-line--removed"
          : "diff-line";
      return (
        <pre key={index} className={className}>
          {part.value}
        </pre>
      );
    })}
  </div>
);

export function ShowMoreButton({ rest, onClick }: { rest: number; onClick: () => void }) {
  if (rest <= 0) return null;
  return (
    <button className="btn btn-ghost btn-block show-more" onClick={onClick}>
      Tampilkan lebih banyak ({rest} lagi)
    </button>
  );
}

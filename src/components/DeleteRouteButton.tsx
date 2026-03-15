interface DeleteRouteButtonProps {
  onDelete: () => void
}

export function DeleteRouteButton({ onDelete }: DeleteRouteButtonProps) {
  function handleClick() {
    if (window.confirm('Delete this route and all cached tiles?')) {
      onDelete()
    }
  }

  return (
    <button className="delete-btn" onClick={handleClick}>
      Delete Route
    </button>
  )
}

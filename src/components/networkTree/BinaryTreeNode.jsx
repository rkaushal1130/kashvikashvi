import React from 'react';
import { User, Award, PlusCircle, Sparkles } from 'lucide-react';
import './BinaryTreeNode.css';

/**
 * BinaryTreeNode
 * Reusable MLM binary node card rendering either:
 * - Active Distributor node with Avatar, Name, ID, Position, Level, Status
 * - Clear EMPTY position slot (+ Available)
 */
export function BinaryTreeNode({
  node,
  position = 'ROOT',
  level = 1,
  isRoot = false,
  isSelected = false,
  isHighlighted = false,
  onClick,
  onHover,
  onLeave,
  onAvailableClick,
}) {
  // 1. EMPTY Position Slot
  if (!node) {
    return (
      <div className="binary-node-container empty-slot-container">
        <div
          className="binary-node-card empty-card"
          onClick={() => onAvailableClick && onAvailableClick(position)}
          role="button"
          tabIndex={0}
          title={`Available ${position} position`}
        >
          <div className="empty-position-badge">{position} OPEN</div>
          <div className="empty-icon-wrap">
            <PlusCircle size={20} className="plus-icon" />
          </div>
          <span className="empty-label">+ Available</span>
          <span className="empty-sublabel">Open Position</span>
        </div>
      </div>
    );
  }

  // 2. ACTIVE Distributor Node
  const name = node.name || node.distributor?.displayName || node.distributor?.firstName || 'Distributor';
  const id = node.distributorId || node.id || node.distributor?.distributorCode || 'KV-0000';
  const nodePosition = node.position || position;
  const nodeLevel = node.level || level;
  const status = (node.status || node.distributor?.status || 'ACTIVE').toUpperCase();
  const isActive = status === 'ACTIVE';
  const rank = node.rank || node.distributor?.rankName || 'Executive';

  return (
    <div className={`binary-node-container ${isRoot ? 'is-root' : ''}`}>
      <div
        className={`binary-node-card active-card ${isActive ? 'status-active' : 'status-inactive'} ${
          isSelected ? 'is-selected' : ''
        } ${isHighlighted ? 'is-highlighted' : ''}`}
        onClick={() => onClick && onClick(node)}
        onMouseEnter={(e) => onHover && onHover(node, e)}
        onMouseLeave={() => onLeave && onLeave()}
        role="button"
        tabIndex={0}
        data-distributor-id={id}
      >
        {/* Top Position & Level Header */}
        <div className="node-top-bar">
          <span className={`node-position-tag pos-${nodePosition.toLowerCase()}`}>
            {isRoot ? 'ROOT' : nodePosition}
          </span>
          <span className="node-level-tag">L{nodeLevel}</span>
        </div>

        {/* Avatar & Profile */}
        <div className="node-body">
          <div className="node-avatar-circle">
            <span className="avatar-initials">{name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="node-text-column">
            <h4 className="node-name" title={name}>
              {name}
            </h4>
            <span className="node-id">{id}</span>
          </div>
        </div>

        {/* Footer: Rank & Status indicator */}
        <div className="node-footer">
          <span className="node-rank" title={rank}>
            {rank}
          </span>
          <span className={`node-status-pill ${isActive ? 'pill-active' : 'pill-inactive'}`}>
            <span className="status-dot" />
            <span>{status}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default BinaryTreeNode;

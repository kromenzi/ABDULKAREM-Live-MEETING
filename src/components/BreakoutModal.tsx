import React, { useState } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Users,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Participant, Language, BreakoutRoomGroup } from '../types';
import { getTranslation } from '../translations';

interface BreakoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  currentPeerId: string;
  mainRoomId: string;
  onSendMoveToRoom: (
    targetPeerId: string,
    targetRoomId: string,
    breakoutName: string
  ) => void;
  onRecallAllToMain: () => void;
  isInsideBreakout: boolean;
  lang: Language;
}

export const BreakoutModal: React.FC<BreakoutModalProps> = ({
  isOpen,
  onClose,
  participants,
  currentPeerId,
  mainRoomId,
  onSendMoveToRoom,
  onRecallAllToMain,
  isInsideBreakout,
  lang,
}) => {
  const t = getTranslation(lang);

  const [rooms, setRooms] = useState<BreakoutRoomGroup[]>([
    {
      id: `${mainRoomId}-breakout-1`,
      name: lang === 'ar' ? 'غرفة نقاش 1' : 'Breakout Group 1',
      peerIds: [],
    },
    {
      id: `${mainRoomId}-breakout-2`,
      name: lang === 'ar' ? 'غرفة نقاش 2' : 'Breakout Group 2',
      peerIds: [],
    },
  ]);

  if (!isOpen) return null;

  const handleAddRoom = () => {
    const nextNum = rooms.length + 1;
    setRooms([
      ...rooms,
      {
        id: `${mainRoomId}-breakout-${nextNum}`,
        name: lang === 'ar' ? `غرفة نقاش ${nextNum}` : `Breakout Group ${nextNum}`,
        peerIds: [],
      },
    ]);
  };

  const handleRemoveRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
  };

  const handleAssignPeer = (peerId: string, targetRoomId: string) => {
    setRooms(
      rooms.map((r) => {
        const withoutPeer = r.peerIds.filter((id) => id !== peerId);
        if (r.id === targetRoomId) {
          return { ...r, peerIds: [...withoutPeer, peerId] };
        }
        return { ...r, peerIds: withoutPeer };
      })
    );
  };

  const assignedPeerIds = new Set(rooms.flatMap((r) => r.peerIds));
  const unassignedParticipants = participants.filter(
    (p) => !assignedPeerIds.has(p.peerId)
  );

  const handleOpenBreakouts = () => {
    // Send move-to-room message for each assigned peer
    rooms.forEach((room) => {
      room.peerIds.forEach((pId) => {
        onSendMoveToRoom(pId, room.id, room.name);
      });
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t.breakoutRooms}</h3>
              <p className="text-xs text-slate-400">{t.breakoutRoomsDesc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Action to Recall Everyone if in breakouts */}
          {isInsideBreakout && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <span className="font-semibold">{t.inBreakoutNotice}</span>
              <button
                type="button"
                onClick={() => {
                  onRecallAllToMain();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.closeBreakouts}</span>
              </button>
            </div>
          )}

          {/* Unassigned Participants in Main Session */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-400" />
                <span>{t.unassignedParticipants}</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                {unassignedParticipants.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
              {unassignedParticipants.length === 0 ? (
                <p className="text-xs text-slate-500">{t.allAssignedBreakout}</p>
              ) : (
                unassignedParticipants.map((p) => (
                  <div
                    key={p.peerId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <span className="font-medium text-slate-200">
                      {p.displayName} {p.peerId === currentPeerId && `(${t.you})`}
                    </span>
                    <select
                      value=""
                      onChange={(e) => handleAssignPeer(p.peerId, e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-sky-400 focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>
                        + {t.assignTo}
                      </option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Breakout Subgroups List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {t.subgroups} ({rooms.length})
              </span>
              <button
                type="button"
                onClick={handleAddRoom}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addBreakoutRoom}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {rooms.map((room) => {
                const roomPeers = participants.filter((p) =>
                  room.peerIds.includes(p.peerId)
                );

                return (
                  <div
                    key={room.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <input
                          type="text"
                          value={room.name}
                          onChange={(e) =>
                            setRooms(
                              rooms.map((r) =>
                                r.id === room.id ? { ...r, name: e.target.value } : r
                              )
                            )
                          }
                          className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(room.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition"
                        title={t.deleteRoom}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Assigned Participants Tags */}
                    <div className="space-y-1.5 min-h-[50px]">
                      <div className="flex flex-wrap gap-1.5">
                        {roomPeers.map((p) => (
                          <span
                            key={p.peerId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 text-xs font-medium"
                          >
                            <span>{p.displayName}</span>
                            <button
                              type="button"
                              onClick={() => handleAssignPeer(p.peerId, '')}
                              className="text-indigo-400 hover:text-white"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        {roomPeers.length === 0 && (
                          <span className="text-[11px] text-slate-500 italic">
                            {t.noParticipantsAssigned}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onRecallAllToMain}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.closeBreakouts}</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
            >
              {t.close}
            </button>
            <button
              onClick={handleOpenBreakouts}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.openBreakouts}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

"use client"

import React from 'react'
import OperatorSidebar from '../../../components/operator-sidebar'
import { useAppData } from '../../../components/context/AppDataContext'
import { useConfirmPass, useCancelPass } from '@/lib/hooks'
import { useWallet } from '@/components/context/WalletContext'

export default function BookingsPage() {
  const { bookings } = useAppData() as any;
  const { address } = useWallet();
  const { confirmPass, isPending: isConfirming, isConfirmed: confirmSuccess } = useConfirmPass();
  const { cancelPass, isPending: isCancelling, isConfirmed: cancelSuccess } = useCancelPass();

  // Filter passes to show only those where the user is the operator (satellite owner)
  const myPasses = bookings.filter((p: any) => p.operator === address);

  async function handleConfirm(passId: string) {
    try {
      await confirmPass(BigInt(passId));
    } catch (error) {
      console.error('Failed to confirm pass:', error);
    }
  }

  async function handleCancel(passId: string) {
    try {
      await cancelPass(BigInt(passId));
    } catch (error) {
      console.error('Failed to cancel pass:', error);
    }
  }

  const getStatusText = (state: number) => {
    switch (state) {
      case 0: return 'Booked';
      case 1: return 'Transferable';
      case 2: return 'Locked';
      case 3: return 'Completed';
      case 4: return 'Verified';
      case 5: return 'Settled';
      case 6: return 'Cancelled';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (state: number) => {
    switch (state) {
      case 0: return 'bg-yellow-600 text-black';
      case 1: return 'bg-blue-600 text-white';
      case 2: return 'bg-orange-600 text-white';
      case 3: return 'bg-purple-600 text-white';
      case 4: return 'bg-green-600 text-white';
      case 5: return 'bg-gray-600 text-white';
      case 6: return 'bg-red-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div>
      <OperatorSidebar />
      <main style={{ marginLeft: 224 }} className="p-6">
        <h2 className="text-xl font-medium text-slate-100 mb-4">My Satellite Passes</h2>
        <div className="space-y-3">
          {myPasses.length === 0 && <div className="text-slate-400">No passes yet.</div>}
          {myPasses.map((pass: any) => (
            <div key={pass.id} className="bg-[#232534] p-4 rounded shadow-sm flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-200">Pass #{pass.id}</div>
                <div className="text-xs text-slate-400">Node: {pass.nodeId} • Satellite: {pass.satId}</div>
                <div className="text-xs text-slate-400">Duration: {pass.durationMin} minutes</div>
                <div className="text-xs text-slate-400">Payment: {pass.payment?.amount || 'N/A'} CTC</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded text-sm ${getStatusColor(pass.state)}`}>
                  {getStatusText(pass.state)}
                </div>
                {pass.state === 0 && ( // Only show buttons for booked passes
                  <>
                    <button
                      onClick={() => handleConfirm(pass.id)}
                      disabled={isConfirming}
                      className="px-3 py-1 rounded bg-slate-700 text-white disabled:opacity-50"
                    >
                      {isConfirming ? 'Confirming...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => handleCancel(pass.id)}
                      disabled={isCancelling}
                      className="px-3 py-1 rounded bg-red-700 text-white disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

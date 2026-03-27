"use client";

import { useState } from 'react';
import { Dataset } from '@/data/mockDatasets';
import { PurchaseModal } from './PurchaseModal';

export function DatasetCard({ dataset }: { dataset: Dataset }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const progress = Math.round((dataset.fundedAmount / dataset.fundingGoal) * 100);

  return (
    <>
      <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-surface-container-high hover:bg-surface-container-highest transition-all group">
        {/* Icon */}
        <div className="relative w-20 h-20 shrink-0 flex items-center justify-center bg-surface-container border border-outline-variant/30">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          <div className="absolute -bottom-1 -right-1 bg-primary text-on-primary p-1 border-2 border-surface-container-high">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Info */}
        <div className="flex-grow">
          <h5 className="font-[family-name:var(--font-plus-jakarta)] font-bold text-lg uppercase tracking-tight mb-1 text-on-surface">
            {dataset.name}
          </h5>
          <p className="font-[family-name:var(--font-manrope)] text-on-surface-variant text-xs uppercase tracking-widest font-semibold">
            {dataset.tags.join(' · ')}
          </p>
        </div>

        {/* Progress */}
        <div className="w-full md:w-48">
          <div className="flex justify-between mb-2">
            <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">CAPITALIZACIÓN</span>
            <span className="text-[10px] text-primary font-bold">{progress}%</span>
          </div>
          <div className="h-1 bg-surface-variant w-full">
            <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>

        {/* Price */}
        <div className="text-right min-w-[140px]">
          <div className="text-primary font-[family-name:var(--font-plus-jakarta)] font-bold text-lg">
            ${dataset.tokenPrice} <span className="text-xs text-on-surface-variant">/ token</span>
          </div>
          <div className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
            {dataset.tokensAvailable} disponibles
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={dataset.tokensAvailable === 0}
          className="bg-primary text-on-primary px-6 py-3 font-[family-name:var(--font-plus-jakarta)] font-extrabold text-[10px] tracking-widest uppercase hover:bg-primary-fixed-dim transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none w-full md:w-auto"
        >
          {dataset.tokensAvailable === 0 ? 'AGOTADO' : 'BUY TOKENS'}
        </button>
      </div>

      <PurchaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        datasetId={dataset.id}
        datasetName={dataset.name}
        tokenPrice={dataset.tokenPrice}
        tokensAvailable={dataset.tokensAvailable}
      />
    </>
  );
}

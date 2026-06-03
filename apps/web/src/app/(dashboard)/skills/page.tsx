'use client';

import { useState } from 'react';

import { FilterBar, FilterBarItem } from '@/components/ui/tabs';
import { Marketplace } from '@/features/skills/components/marketplace';
import { MySkills } from '@/features/skills/components/my-skills';

type Tab = 'mine' | 'marketplace';

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>('mine');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 pt-4">
        <FilterBar className="w-fit">
          <FilterBarItem
            value="mine"
            onClick={() => setTab('mine')}
            data-state={tab === 'mine' ? 'active' : 'inactive'}
          >
            Minhas Skills
          </FilterBarItem>
          <FilterBarItem
            value="marketplace"
            onClick={() => setTab('marketplace')}
            data-state={tab === 'marketplace' ? 'active' : 'inactive'}
          >
            Marketplace
          </FilterBarItem>
        </FilterBar>
      </div>

      {tab === 'mine' ? <MySkills /> : <Marketplace />}
    </div>
  );
}

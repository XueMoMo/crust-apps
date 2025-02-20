// Copyright 2017-2021 @polkadot/apps authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { TFunction } from 'i18next';
import type { Route, Routes } from '@polkadot/apps-routing/types';
import type { ApiProps } from '@polkadot/react-api/types';
import type { AccountId } from '@polkadot/types/interfaces';
import type { Group, Groups, ItemRoute } from './types';

import React, { useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import createRoutes from '@polkadot/apps-routing';
import { useAccounts, useApi, useCall } from '@polkadot/react-hooks';

import { findMissingApis } from '../endpoint';
import { useTranslation } from '../translate';
import ChainInfo from './ChainInfo';
import Grouping from './Grouping';
import Item from './Item';
import NodeInfo from './NodeInfo';

interface Props {
  className?: string;
}

const disabledLog = new Map<string, string>();

function createExternals (t: TFunction): ItemRoute[] {
  return [
    { href: 'https://github.com/crustio/crust-apps', icon: 'code-branch', name: 'github', text: t<string>('nav.github', 'GitHub', { ns: 'apps-routing' }) },
    { href: 'https://wiki.crust.network', icon: 'book', name: 'wiki', text: t<string>('nav.wiki', 'Wiki', { ns: 'apps-routing' }) },
    { href: 'https://wiki.crust.network/docs/en/crustWallet', icon: 'wallet', name: 'wallet', text: t<string>('nav.Wallet', 'Wallet', { ns: 'apps-routing' }) }
  ];
}

function logDisabled (route: string, message: string): void {
  if (!disabledLog.get(route)) {
    disabledLog.set(route, message);

    console.warn(`Disabling ${route}: ${message}`);
  }
}

function checkVisible (name: string, { api, isApiConnected, isApiReady }: ApiProps, hasAccounts: boolean, hasSudo: boolean, { isHidden, needsAccounts, needsApi, needsSudo }: Route['display']): boolean {
  if (isHidden) {
    return false;
  } else if (needsAccounts && !hasAccounts) {
    return false;
  } else if (!needsApi) {
    return true;
  } else if (!isApiReady || !isApiConnected) {
    return false;
  } else if (needsSudo && !hasSudo) {
    logDisabled(name, 'Sudo key not available');

    return false;
  }

  const notFound = findMissingApis(api, needsApi);

  if (notFound.length !== 0) {
    logDisabled(name, `API not available: ${notFound.toString()}`);
  }

  return notFound.length === 0;
}

function extractGroups (routing: Routes, groupNames: Record<string, string>, apiProps: ApiProps, hasAccounts: boolean, hasSudo: boolean): Group[] {
  return Object
    .values(
      routing.reduce((all: Groups, route): Groups => {
        if (!all[route.group]) {
          all[route.group] = { name: groupNames[route.group], routes: [route] };
        } else {
          all[route.group].routes.push(route);
        }

        return all;
      }, {})
    )
    .map(({ name, routes }): Group => ({
      name,
      routes: routes.filter(({ display, name }) => checkVisible(name, apiProps, hasAccounts, hasSudo, display))
    }))
    .filter(({ routes }) => routes.length);
}

function Menu ({ className = '' }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { allAccounts, hasAccounts } = useAccounts();
  const apiProps = useApi();
  const sudoKey = useCall<AccountId>(apiProps.isApiReady && apiProps.api.query.sudo?.key);
  const location = useLocation();

  const externalRef = useRef(createExternals(t));

  const groupRef = useRef({
    accounts: t('Accounts'),
    developer: t('Developer'),
    governance: t('Governance'),
    network: t('Network'),
    settings: t('Settings'),
    storage: t('Storage market'),
    csmStaking: t('Profit Data')
  });

  const routeRef = useRef(createRoutes(t));

  const hasSudo = useMemo(
    () => !!sudoKey && allAccounts.some((address) => sudoKey.eq(address)),
    [allAccounts, sudoKey]
  );

  const visibleGroups = useMemo(
    () => extractGroups(routeRef.current, groupRef.current, apiProps, hasAccounts, hasSudo),
    [apiProps, hasAccounts, hasSudo]
  );

  const activeRoute = useMemo(
    () => routeRef.current.find((route) => location.pathname.startsWith(`/${route.name}`)) || null,
    [location]
  );

  const isLoading = !apiProps.isApiReady || !apiProps.isApiConnected;

  return (
    <div className={`${className}${isLoading ? ' isLoading' : ''} highlight--bg`}>
      <div className='menuContainer'>
        <div className='menuSection'>
          <ChainInfo />
          <ul className='menuItems'>
            {visibleGroups.map(({ name, routes }): React.ReactNode => (
              <Grouping
                isActive={ activeRoute && activeRoute.group === name.toLowerCase()}
                key={name}
                name={name}
                routes={routes}
              />
            ))}
          </ul>
        </div>
        <div className='menuSection media--1200'>
          <ul className='menuItems'>
            {externalRef.current.map((route): React.ReactNode => (
              <Item
                className='external'
                isLink
                isToplevel
                key={route.name}
                route={route}
              />
            ))}
          </ul>
        </div>
        <NodeInfo/>
      </div>
    </div>
  );
}

export default React.memo(styled(Menu)`
  width: 100%;
  padding: 0;
  z-index: 220;
  position: relative;

  & .menuContainer {
    flex-direction: row;
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: 0 1.5rem;
    width: 100%;
    max-width: var(--width-full);
    margin: 0 auto;
  }

  &.isLoading {
    background: #999 !important;

    .menuActive {
      background: var(--bg-page);
    }

    &:before {
      filter: grayscale(1);
    }

    .menuItems {
      filter: grayscale(1);
    }
  }

  .menuSection {
    align-items: center;
    display: flex;
  }

  .menuActive {
    background: var(--bg-tabs);
    border-bottom: none;
    border-radius: 0.25rem 0.25rem 0 0;
    color: var(--color-text);
    padding: 1rem 1.5rem;
    margin: 0 1rem -1px;
    z-index: 1;

    .ui--Icon {
      margin-right: 0.5rem;
    }
  }

  .menuItems {
    flex: 1 1;
    list-style: none;
    margin: 0 1rem 0 0;
    padding: 0;

    > li {
      display: inline-block;
    }

    > li + li {
      margin-left: 0.375rem
    }
  }

  .ui--NodeInfo {
    align-self: center;
  }

`);

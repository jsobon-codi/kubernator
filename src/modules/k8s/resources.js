import { all, call } from 'redux-saga/effects';
import update from 'immutability-helper';

import {
  toKeysObject,
  toKeysArray,
} from '../../utils';

import {
  PREFIX,
  ID,
  URL,
  GROUP_ID,
  RESOURCE_IDS,
  ITEM_IDS,
  IS_LISTABLE,
  URL_PART_GROUP,
  URL_PART_RESOURCE,
  cacheGet,
  putTake,
  takeEveryReq,
  selectArrOptional,
} from './shared';

import {
  MODELS_GET__S,
  MODELS_GET__F,
  modelsGet,
} from './models';


// action codes
// --------------

export const RESOURCES_GET = `${PREFIX}/RESOURCES_GET`;
export const RESOURCES_GET__S = `${PREFIX}/RESOURCES_GET/S`;
export const RESOURCES_GET__F = `${PREFIX}/RESOURCES_GET/F`;


// action creators
// -----------------

export const resourcesGet = group => ({
  type: RESOURCES_GET,
  payload: { group },
});


// state
// ---------

export function resourcesSelectByGroup(state, group) {
  const { resources } = state[PREFIX];
  return selectArrOptional(group[RESOURCE_IDS].map(id => resources[id]));
}

export function resourcesSelectByNamespaced(state, namespaced) {
  const { resources } = state[PREFIX];
  return Object.keys(resources)
    .filter(id => {
      const resource = resources[id];
      return (
        resource[IS_LISTABLE] &&
        resource.namespaced === namespaced
      );
    })
    .map(id => resources[id]);
}

export function resourceSelect(state, id) {
  return state[PREFIX].resources[id];
}

export function resourceSelectByKind(state, kind) {
  const { resources } = state[PREFIX];

  // find correponding resources
  const resourceIds = Object.keys(resources)
    .filter(resourceId => {
      const resource = resources[resourceId];
      return (
        resource.kind === kind &&
        resource.verbs.includes('create')
      );
    });

  // error if more than 1 result
  if (resourceIds.length !== 1) return null;
  else return resources[resourceIds[0]];
}

export const resourcesState = {
  resources: {},
};


// saga
// ------

function* sagaResourcesGet() {
  yield takeEveryReq(
    [
      RESOURCES_GET,
      RESOURCES_GET__S,
      RESOURCES_GET__F,
    ],
    function* (action) {
      const { group } = action.payload;

      // resources
      const { resources } = yield call(cacheGet, group[URL]);

      // decorate
      const decorate = resourceDecorate(group);
      resources.forEach(resource => decorate(resource));

      // models
      yield putTake(modelsGet(group), [MODELS_GET__S, MODELS_GET__F]);

      //
      return { group, resources };
    },
  );
}

export function* resourcesSaga() {
  yield all([
    sagaResourcesGet(),
  ]);
}


// reducer
// ---------

export const resourcesReducer = {

  [RESOURCES_GET__S]: (state, action) => {
    const { group, resources } = action.payload;
    return update(state, {
      groups: {
        [group[ID]]: {
          [RESOURCE_IDS]: { $set: toKeysArray(resources, ID) },
        },
      },
      resources: { $merge: toKeysObject(resources, ID) },
    });
  },
};


// helpers
// ---------

export function resourceDecorate(group) {
  const {
    [ID]: groupId,
    [URL]: groupUrl,
  } = group;
  return resource => {
    const { name, verbs } = resource;

    resource[GROUP_ID] = groupId;
    resource[ID] = name;
    resource[URL] = `${groupUrl}/${name}`;
    resource[ITEM_IDS] = [];
    resource[IS_LISTABLE] = verbs.includes('list');

    // crunches for correct item urls
    resource[URL_PART_GROUP] = groupUrl;
    resource[URL_PART_RESOURCE] = `${name}`;
  };
}

export function resourceGetUrl(resource, namespace) {
  return namespace
    ? `${resource[URL_PART_GROUP]}/namespaces/${namespace}/${resource[URL_PART_RESOURCE]}`
    : resource[URL];
}

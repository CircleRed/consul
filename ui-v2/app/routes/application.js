import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { hash } from 'rsvp';
import { get } from '@ember/object';
import { next } from '@ember/runloop';
const $html = document.documentElement;
const removeLoading = function() {
  return $html.classList.remove('ember-loading');
};
export default Route.extend({
  init: function() {
    this._super(...arguments);
  },
  repo: service('repository/dc'),
  actions: {
    loading: function(transition, originRoute) {
      let dc = null;
      if (originRoute.routeName !== 'dc') {
        const model = this.modelFor('dc') || { dcs: null, dc: { Name: null } };
        dc = get(this, 'repo').getActive(model.dc.Name, model.dcs);
      }
      hash({
        loading: !$html.classList.contains('ember-loading'),
        dc: dc,
      }).then(model => {
        next(() => {
          const controller = this.controllerFor('application');
          controller.setProperties(model);
          transition.promise.finally(function() {
            removeLoading();
            controller.setProperties({
              loading: false,
              dc: model.dc,
            });
          });
        });
      });
      return true;
    },
    error: function(e, transition) {
      // TODO: Normalize all this better
      let error = {
        status: e.code || '',
        message: e.message || e.detail || 'Error',
      };
      if (e.errors && e.errors[0]) {
        error = e.errors[0];
        error.message = error.title || error.detail || 'Error';
      }
      // TODO: Unfortunately ember will not maintain the correct URL
      // for you i.e. when this happens the URL in your browser location bar
      // will be the URL where you clicked on the link to come here
      // not the URL where you got the 403 response
      // Currently this is dealt with a lot better with the new ACLs system, in that
      // if you get a 403 in the ACLs area, the URL is correct
      // Moving that app wide right now wouldn't be ideal, therefore simply redirect
      // to the ACLs URL instead of maintaining the actual URL, which is better than the old
      // 403 page
      // To note: Consul only gives you back a 403 if a non-existent token has been sent in the header
      // if a token has not been sent at all, it just gives you a 200 with an empty dataset
      if (error.status === '403') {
        return this.transitionTo('dc.acls.tokens');
      }
      if (error.status === '') {
        error.message = 'Error';
      }
      const model = this.modelFor('dc');
      hash({
        error: error,
        dc:
          error.status.toString().indexOf('5') !== 0
            ? get(this, 'repo').getActive()
            : model && model.dc
              ? model.dc
              : { Name: 'Error' },
        dcs: model && model.dcs ? model.dcs : [],
      })
        .then(model => {
          removeLoading();
          next(() => {
            this.controllerFor('error').setProperties(model);
          });
        })
        .catch(e => {
          removeLoading();
          next(() => {
            this.controllerFor('error').setProperties({ error: error });
          });
        });
      return true;
    },
  },
});

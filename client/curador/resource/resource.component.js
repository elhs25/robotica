'use strict';
import angular from 'angular';
import CuradorComponent from '../curador.component';
import async from 'async';
import _ from 'lodash';

export default class ResourceComponent extends CuradorComponent {
  /*@ngInject*/
  constructor($scope, $element, $stateParams, Auth, Restangular, $log, Util, $timeout, $state, $mdDialog, $mdConstant, ngMeta) {
    super({$element, Restangular, $log});

		this.$scope = $scope;
		this.currentStep = 'ficha';
		this.loading = true;
		this.Restangular = Restangular;
		this.$stateParams = $stateParams;
		this.uid = this.$stateParams.uid;
		this.Util = Util;
		this.$timeout = $timeout;
		this.init = true;
		this.isDelete = $stateParams.action === 'remove';
		this.$state = $state;
		this.$mdDialog = $mdDialog;
		this.ngMeta = ngMeta;

		// Global captions to avoid unnecesary temporary captions inside functions
		this.captions = {
			'propuesta': 'Propuesta pedagógica',
			'actividad': 'Actividad accesible',
			'herramienta': 'Herramienta',
			'orientacion': 'Orientación',
			'mediateca': 'Mediateca',
			'desafio': 'Desafío',
		};

		this.Resource = this.Restangular.one('resources', this.uid)
		this.Publisheds = this.Restangular.all('resources');

		// tag separators
		this.tagsKeys = [$mdConstant.KEY_CODE.ENTER, $mdConstant.KEY_CODE.COMMA];
		
		this.resource = { };
		this.steps = [
			{ name: 'ficha', 		caption: 'Ficha' },
			{ name: 'recurso', 	caption: 'Recurso' },
			{ name: 'vinculo', caption: 'Vínculo' },
			{ name: 'publicar', caption: 'Publicar' },
		];

		this.configureDropzone(Util);
		this.configureFunctions();
		this.getResource();
		this.getCategories_();

		this.onDeletePost = ($index) => {
			this.onDeletePost_($index);
		};

		this.$scope.$watch(() => { return this.filterText }, (value) => {
			this.refreshUI(true);
		});
	}

	$onInit(){
	}

	refreshUI(forceApply){
		this.headText = this.captions[this.resource.type];
		this.showViculo = ['propuesta', 'actividad', 'orientacion' ].indexOf(this.resource.type) > -1;
		this.getPublisheds(forceApply);
	}

	getPublisheds(forceApply){
		if (!this.showViculo){
			return;
		}
    let q;
    if (this.filterText){
      q = this.filterText
		}

		this.Publisheds
			.getList({
				q: q
			})
			.then(publisheds => {
				let filtered = _.filter(publisheds, p => {
					return p._id !== this.uid;
				});

				this.publisheds = _.map(filtered, p =>{
					p.typeCaption = this.captions[p.type];
					return p;
				});

				if (forceApply){
					//this.$scope.$apply();
				}
			});
	}

	getCategories_(){
		async.waterfall([
			(cb) => {
				this
					.loadCategories()
					.then(() => cb())
					.catch(cb);
			},
			(cb) => {
				// here init the stuff
				let st = this.getCategory('software');
				let at = this.getCategory('area');
				let lt = this.getCategory('nivel');
				let ac = this.getCategory('accessibility');
				let us = this.getCategory('resource');
				let os = this.getCategory('os');
				let or = this.getCategory('orientacion');
				
				this.softwares = st.values;
				this.areas = at.values;
				this.niveles = lt.values;
				this.accessibilities = ac.values;
				this.usabilities = us.values;
				this.platforms = os.values;
				this.orientaciones = or.values;
				cb()
			}
		], err => {
			if (err){
				this.$log.error(err);
			}
		});
	}

	watchResource(){
		this.saveTimes = 0;

		this.$scope.$watch(() => { return this.resource; }, (value) => {
			this.refreshUI();
			this.saveTimes++;
			if (this.saveTimes <= 1){
				return;
			}
			if (this.saverHandler) {
				clearInterval(this.saverHandler);
			}
			this.saverHandler = setInterval(() => {
				this.saveResource();
				clearInterval(this.saverHandler);
			}, 500);
		}, true);
	}

	configureFunctions(){	
		this.onEnterStep = (step) => {
			this.$timeout(() => {
				this.currentStep = step.name;
				
				if (!this.init && !this.loading){
					this.resource.step = this.currentStep;
				}
				
				this.init = false;
				this.$scope.$apply();
			});
		};

		this.save = () => {
			this.saveResource();
		};

		this.finish = ($event) => {
			this.publish();
		}
	}

	configureDropzone(Util){

		var ctrl = this;
   	 this.dzOptions = {
			dictDefaultMessage: '<div class="dz-clickable"></div>',
      url : '/upload?relative=' + this.uid,
			paramName : 'Imágen',
			maxFiles: 1,
			clickable: '.dz-tumbnail-clickable',
			maxFilesize : 1024,
			timeout: 18000000,
      acceptedFiles : 'image/*',
      addRemoveLinks : false,
			headers: Util.getHeaders(),
			init: function(){
				// add dropzone to ctrl
				ctrl.dropzoneThumbnail = this;
			}
		};

    this.dzCallbacks = {
      'addedfile' : (file) => {
				
			},
			'removedfile' : (file) => {
				
      },
      'success' : (file, xhr) => {
				console.log(xhr);
				this.resource.thumbnail = xhr.url;
			},
			'processing': () => {
				
			},
			'queuecomplete': () => {
				ctrl.dropzoneThumbnail.removeAllFiles();
			}
		};

		this.dzOptionsSoftware = _.cloneDeep(this.dzOptions);
		this.dzOptionsSoftware.init = function(){
			// add dropzone to ctrl
			ctrl.dropzoneSoftware = this;
		};
		this.dzOptionsSoftware.acceptedFiles = undefined; //'*/*';
		this.dzOptionsSoftware.maxFiles = Infinity;
		this.dzOptionsSoftware.dictDefaultMessage = '<div class="dz-clickable"></div>';
		this.dzOptionsSoftware.clickable = '.dz-software-clickable';

		this.dzCallbacksSoftware = {
      'addedfile' : (file) => {
				
			},
			'removedfile' : (file) => {
				
      },
      'success' : (file, xhr) => {
				this.resource.files.push(xhr);
			},
      'error' : (err) => {
				this.$log.error(err);
			},
			'processing': () => {
				
			},
			'queuecomplete': () => {
				//ctrl.dropzoneSoftware.removeAllFiles();
			}
    };
	}

	getResource(){
		this.Resource
		.get()
		.then(data => {
			this.resource = data;

			this.ngMeta.setTitle(this.resource.title);
			this.ngMeta.setTag('description', this.resource.summary);

			if (typeof this.resource.area == 'string'){
				this.resource.area = [];
			}

			if (typeof this.resource.nivel == 'string'){
				this.resource.nivel = [];
			}

			if (this.resource.step){
				let idx = _.findIndex(this.steps, { name: this.resource.step });
				this.initStepIndex = idx === -1 ? undefined : idx;
			}

			if (this.resource.type === 'mediateca'){
				this.steps = [
					{ name: 'ficha', 		caption: 'Ficha' },
					{ name: 'recurso', 	caption: 'Recurso' },
					//{ name: 'vinculo', caption: 'Vínculo' },
					{ name: 'publicar', caption: 'Publicar' },
				];
			}

			//===============================================
			// Exclusive 'Desafios' validations
			//===============================================
			
			if(this.resource.type === 'desafio')
			{
				// Create angular 'Desafios' variables 
				this.districts = {};
				this.selectedDistrict = {};
				this.selectedSchool = {};

				this.searchDistrictText = this.resource.district || 'La Plata';
				this.searchSchoolText = '';

				this.rate = this.resource.rate || 0;

				this.School = this.Restangular.one('schools/district', this.searchDistrictText);

				this.getSchool();
			}

			//===============================================


			_.each(this.resource.links, l =>{
				l.typeCaption = this.captions[l.type];
			});

			this.loading = false;
			this.watchResource()
		})
		.catch(err => {
			throw err;
		});
	}


	getSchool(){
		this.loading = true;
		this.School.get()
		.then(data => {

			this.district = data;

			let resourceInstance = this;

			let schoolIndex = _.findIndex(this.district.schools, function (element) {
				return (element.schoolName == resourceInstance.resource.school);						
			});

			if(schoolIndex == -1)
			{
				schoolIndex = 0;
			}			

			this.selectedDistrict = this.district;
			this.searchDistrictText = angular.copy(this.selectedDistrict.name);

			this.selectedSchool = angular.copy(this.district.schools[schoolIndex].schoolName);
			this.searchSchoolText = this.selectedSchool;

			this.loading = false;
		})
		.catch(err => {
			this.loading = false;
			console.log("Err", err);
			throw err;
		});
	}


	onChangeDistrict(newDistrict)
	{
		if(_.isEmpty(newDistrict) == false)
		{
			let districtIndex = _.findIndex(this.getDistricts(), function (element) {
				return (element == newDistrict);			
			});

			// If the search district were found...
			if(districtIndex != -1)
			{
				this.School = this.Restangular.one('schools/district', newDistrict);
		
				// Let's retrieve the school information
				this.getSchool();
			}
		}
	}


	$onDestroy() {
		if (this.saverHandler) {
			clearInterval(this.saverHandler);
		}
	}
	
	saveResource(){

		this.onSaveResource();

		this.resource
			.put()
			.then(data => {
				this.$log.log('autosaved', data);
			})
			.catch(err => {
				throw err;
			});
	}


	onSaveResource()
	{
		if(this.resource.type === 'desafio')
		{
			this.resource.district = angular.copy(this.selectedDistrict.name);
			this.resource.school = angular.copy(this.selectedSchool);
			this.resource.rate = angular.copy(this.rate);
		}
	}

	
	canNext(step){
    return true;
  }
	
	editTumbnail(){
		
	}

	exists(item, list){
		if (list == undefined){
			return false;
		}
		return list.indexOf(item) > -1;
	}

	toggle(item, list){
		if (list == undefined){
			return;
		}
		var idx = list.indexOf(item);
    if (idx > -1) {
      list.splice(idx, 1);
    }
    else {
      list.push(item);
    }
	}

	existsObject(item, list){
		return _.some(list, l => {
			if (typeof l === 'string'){
				return l == item._id;
			}
			return l._id == item._id;
		});
	}

	toggleObject(item, list){
    var idx = _.findIndex(list, l => {
			if (typeof l === 'string'){
				return l == item._id;
			}
			return l._id == item._id;
		});
		
    if (idx > -1) {
      list.splice(idx, 1);
    }
    else {
      list.push(item);
    }
	}

	onDeletePost_($index){
		if (this.resource.postBody instanceof Array){
			this.resource.postBody.splice($index, 1);
		}
	}

	textSelection(length){
		if (length > 1){
			return 'seleccionados';
		}
		return 'seleccionado';
	}

	removeAllFiles(){
		this.resource.files.splice(0, this.resource.files.length)
	}

	sumfiles(files){
		return _.sumBy(files, 'size');
	}

	deleteResource(){
		let Published = this.Restangular.one('publisheds', this.uid)
		this.loading = true;
		
		this
			.Resource
			.remove()
			.then( data => {
				if (this.resource.published) {
					Published
					.remove()
					.then( data => {
						this.$state.go('curador.dashboard');
					})
					.catch( err => {
						throw err;
					});
				} else {
					this.$state.go('curador.dashboard');
				}
			})
			.catch( err => {
				throw err;
			});
	}
	
	publish(ev){
		// Appending dialog to document.body to cover sidenav in docs app
		var confirm = this.$mdDialog.confirm()
					.title('¿Está seguro que desea hacer publico este recurso?')
					.ariaLabel('Publicación del Recurso')
					.targetEvent(ev)
					.ok('Publicar')
					.cancel('Cancelar');

		this.$mdDialog.show(confirm).then(() => {
			this.releasePublish();
		}, () => {
		});
	}
	
	releasePublish(){
		this.loading = true;
		this.resource
			.post('publish')
			.then(data => {
				this.$log.log('published', data);
				this.loading = false;
				this.$state.go('curador.dashboard');
			})
			.catch(err => {
				throw err;
			});
	}


	getResourceType(type){
		return this.captions[type];
	}

	getDistricts()
	{
		let _districts = ['La Plata', 'Adolfo Alsina', 'Alberti', 'Almirante Brown',
			"Avellaneda", "Ayacucho", "Azul", "Bahía Blanca", "Balcarce",
			"Baradero", "Arrecifes", "Bolívar", "Bragado", "Brandsen",
			"Campana", "Cañuelas", "Carlos Casares", "Carlos Tejedor", "Carmen de Areco",
			"Daireaux", "Castelli", "Colón", "Coronel Dorrego", "Coronel Pringles",
			"Coronel Suárez", "Chacabuco", "Chascomús", "Chivilcoy", "Dolores",
			"Esteban Echeverría", "Exaltación de la Cruz", "Florencio Varela", "General Alvarado", "General Alvear",
			"General Arenales", "General Belgrano", "General Guido", "General La Madrid", "General Lavalle",
			"General Madariaga", "General Paz", "General Pinto", "General Pueyrredón", "General Rodríguez",
			"General San Martín", "Zárate", "General Viamonte", "General Villegas", "Gonzáles Chaves",
			"Guaminí", "Juárez", "Junín", "Laprida", "Tigre",
			"Las Flores", "General Las Heras", "Leandro N. Alem", "Lincoln", "Lobería",
			"Lobos", "Lomas de Zamora", "Luján", "Magdalena", "Maipú", "Salto",
			"Marcos Paz", "Mar Chiquita", "La Matanza", "Mercedes", "Merlo", "Monte",
			"Moreno", "Navarro", "Necochea", "Nueve de Julio", "Olavarría", "Patagones",
			"Pehuajó", "Pellegrini", "Pergamino", "Pila", "Pilar",
			"Puan", "Quilmes", "Ramallo", "Rauch", "Rivadavia",
			"Rojas", "Roque Pérez", "Saavedra", "Saladillo", "San Andrés de Giles",
			"San Antonio de Areco", "San Fernando", "San Isidro", "San Nicolás", "San Pedro",
			"San Vicente", "Morón", "Suipacha", "Tandil", "Tapalqué", 
		    "Tordillo", "Tornquist", "Trenque Lauquen", "Tres Arroyos", "Veinticinco de Mayo",
		    "Vicente López", "Villarino", "Lanús", "Coronel Rosales", "Berisso", "Ensenada", 
		    "San Cayetano", "Escobar", "Tres de Febrero", "Hipólito Yrigoyen", "Berazategui",
		    "Salliqueló", "Capitán Sarmiento", "La Costa", "Pinamar", "Villa Gesell",
		    "Monte Hermoso", "Tres Lomas", "Florentino Ameghino", "Presidente Perón", "Ezeiza",
		    "San Miguel", "José C. Paz", "Malvinas Argentinas", "Punta Indio", "Hurlingham",
		    "Ituzaingo", "Lezama"
		];
		return _districts;
	}
}

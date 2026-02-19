// categoryRoutes.js
const r = require('express').Router();
const c = require('../controllers/categoryController');
r.get('/', c.getCategories);
r.post('/', c.createCategory);
r.put('/:id', c.updateCategory);
r.delete('/:id', c.deleteCategory);
module.exports = r;

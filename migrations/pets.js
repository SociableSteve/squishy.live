exports.up = (pg) => {
				pg.createTable('pets', {
								id: { type: "varchar", primary: true },
								channel: {type: "varchar(32)", notNull: true, unique: true },
								name: "varchar",
								happiness: {type: "int", default: 4, notNull: true},
								hunger: {type: "int", default: 4, notNull: true},
								health: {type: "int", default: 4, notNull: true},
								social: {type: "int", default: 4, notNull: true}, 
				});
};

exports.down = (pg) => {
				pg.dropTable('pets');
};


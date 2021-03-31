exports.up = (pg) => {
				pg.createTable('sessions', {
								id: { type: "varchar", primary: true },
								content: "text"
				});
};

exports.down = (pg) => {
				pg.dropTable('sessions');
};

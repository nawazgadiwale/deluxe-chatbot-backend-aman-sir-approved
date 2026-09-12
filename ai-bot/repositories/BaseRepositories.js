const mongoose = require("mongoose");

class BaseRepository {
  constructor() {
    this.model = null;
  }

  isConnected() {
    return Boolean(
      this.model &&
        mongoose.connection &&
        (mongoose.connection.readyState === 1 ||
          mongoose.connection.readyState === 2),
    );
  }

  async create(data) {
    if (!this.isConnected()) {
      return { _id: new mongoose.Types.ObjectId(), ...data };
    }
    return this.model.create(data);
  }

  async findById(id) {
    if (!this.isConnected()) {
      return null;
    }
    return this.model.findById(id);
  }

  async findOne(filter = {}, projection = null, options = {}) {
    if (!this.isConnected()) {
      return null;
    }
    return this.model.findOne(filter, projection, options);
  }

  async find(filter = {}, projection = null, options = {}) {
    if (!this.isConnected()) {
      return [];
    }
    return this.model.find(filter, projection, options);
  }

  async update(filter, update, options = {}) {
    if (!this.isConnected()) {
      return null;
    }
    return this.model.findOneAndUpdate(filter, update, {
      new: true,
      ...options,
    });
  }

  async delete(filter) {
    if (!this.isConnected()) {
      return null;
    }
    return this.model.findOneAndDelete(filter);
  }

  async exists(filter) {
    if (!this.isConnected()) {
      return null;
    }
    return this.model.exists(filter);
  }

  async count(filter = {}) {
    if (!this.isConnected()) {
      return 0;
    }
    return this.model.countDocuments(filter);
  }
}

module.exports = BaseRepository;

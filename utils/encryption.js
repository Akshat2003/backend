const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');

class Encryption {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  async hashPassword(password) {
    try {
      if (!password) {
        throw new Error('Password is required');
      }

      const salt = await bcrypt.genSalt(this.saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      logger.debug('Password hashed successfully');
      return hashedPassword;
    } catch (error) {
      logger.error('Error hashing password:', error.message);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} - Comparison result
   */
  async comparePassword(password, hash) {
    try {
      if (!password || !hash) {
        throw new Error('Password and hash are required');
      }

      const isMatch = await bcrypt.compare(password, hash);
      logger.debug(`Password comparison result: ${isMatch}`);
      return isMatch;
    } catch (error) {
      logger.error('Error comparing password:', error.message);
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Generate random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} - Random hex token
   */
  generateRandomToken(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      logger.error('Error generating random token:', error.message);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate random OTP
   * @param {number} length - OTP length (default: 6)
   * @returns {string} - Numeric OTP
   */
  generateOTP(length = 6) {
    try {
      const min = Math.pow(10, length - 1);
      const max = Math.pow(10, length) - 1;
      return Math.floor(Math.random() * (max - min + 1) + min).toString();
    } catch (error) {
      logger.error('Error generating OTP:', error.message);
      throw new Error('OTP generation failed');
    }
  }

  /**
   * Hash data using SHA256
   * @param {string} data - Data to hash
   * @returns {string} - SHA256 hash
   */
  sha256Hash(data) {
    try {
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (error) {
      logger.error('Error creating SHA256 hash:', error.message);
      throw new Error('SHA256 hashing failed');
    }
  }

  /**
   * Create HMAC signature
   * @param {string} data - Data to sign
   * @param {string} secret - Secret key
   * @returns {string} - HMAC signature
   */
  createHMAC(data, secret) {
    try {
      return crypto.createHmac('sha256', secret).update(data).digest('hex');
    } catch (error) {
      logger.error('Error creating HMAC:', error.message);
      throw new Error('HMAC creation failed');
    }
  }

  /**
   * Verify HMAC signature
   * @param {string} data - Original data
   * @param {string} signature - HMAC signature to verify
   * @param {string} secret - Secret key
   * @returns {boolean} - Verification result
   */
  verifyHMAC(data, signature, secret) {
    try {
      const expectedSignature = this.createHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying HMAC:', error.message);
      return false;
    }
  }

  /**
   * Encrypt text using AES-256-GCM
   * @param {string} text - Text to encrypt
   * @param {string} key - Encryption key (32 bytes)
   * @returns {Object} - Encrypted data with IV and tag
   */
  encryptAES(text, key) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting with AES:', error.message);
      throw new Error('AES encryption failed');
    }
  }

  /**
   * Decrypt text using AES-256-GCM
   * @param {Object} encryptedData - Encrypted data object
   * @param {string} key - Decryption key
   * @returns {string} - Decrypted text
   */
  decryptAES(encryptedData, key) {
    try {
      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting with AES:', error.message);
      throw new Error('AES decryption failed');
    }
  }
}

module.exports = new Encryption();